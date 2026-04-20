import { randomUUID } from "node:crypto";
import { ChildProcessWithoutNullStreams } from "node:child_process";
import {
  LoopRuntimeExecutionOverrides,
  MinimalLoopRuntime
} from "./minimal-runtime";
import { LiveRunState } from "./live-run-state";
import { createImmediateRun, findQueuedRunByTaskId, shouldSilentlySkipTimerConflict } from "./queue-control";
import { LoopTaskStore } from "./store";
import {
  clamp,
  ensureValidNumericPatch,
  ensureWorkflowHasEnabledSteps,
  ensureWorkflowList,
  ensureWorkflowSteps,
  hasNoEnabledWorkflowSteps,
  isWorkflowDefinitionEqual,
  normalizeLoadedTask,
  normalizeOptionalPositiveInt,
  normalizeTaskInput,
  nowIso,
  parseBoundedNumber,
  parseOptionalBoolean
} from "./task-normalization";
import {
  CreateLoopTaskInput,
  LoopRun,
  LoopRunLive,
  LoopTask,
  UpdateLoopTaskInput,
  WorkflowStep
} from "./types";

type RunTaskOptions = {
  persistTaskState: boolean;
  recordRun: boolean;
  restartIfRunning?: boolean;
  resumeStepIndex?: number | null;
  executionOverrides?: LoopRuntimeExecutionOverrides;
};

type QueuedRun = {
  task: LoopTask;
  trigger: "timer" | "manual";
  options: RunTaskOptions;
  enqueuedAt: string;
  resolveRuns: Array<(run: LoopRun) => void>;
};

type RunningTaskControl = {
  runId: string;
  cancelReason: string | null;
  stopAfterRoundReason: string | null;
  child: ChildProcessWithoutNullStreams | null;
};

export class LoopScheduler {
  private readonly store: LoopTaskStore;
  private readonly runtime: MinimalLoopRuntime;
  private readonly tasks: Map<string, LoopTask> = new Map();
  private readonly timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly running: Set<string> = new Set();
  private readonly runningControls: Map<string, RunningTaskControl> = new Map();
  private readonly runs: LoopRun[] = [];
  private readonly liveRunState: LiveRunState = new LiveRunState();
  private readonly queue: QueuedRun[] = [];
  private maxConcurrentRuns = 4;

  constructor(storePath: string) {
    this.store = new LoopTaskStore(storePath);
    this.runtime = new MinimalLoopRuntime();
  }

  // Backward-compatible alias kept for existing tests/helpers.
  get agentRuntime(): MinimalLoopRuntime {
    return this.runtime;
  }

  async init(): Promise<void> {
    const loaded = await this.store.load();
    for (const task of loaded) {
      this.tasks.set(task.id, normalizeLoadedTask(task));
    }
    this.syncTimers();
  }

  shutdown(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  listTasks(): LoopTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listRuns(limit = 40): LoopRun[] {
    const n = clamp(limit, 1, 200);
    return this.runs.slice(0, n);
  }

  listLiveRuns(limit = 20): LoopRunLive[] {
    return this.liveRunState.list(limit);
  }

  listQueue(limit = 40): Array<{ taskId: string; taskName: string; trigger: "timer" | "manual"; enqueuedAt: string; waitMs: number }> {
    const n = clamp(limit, 1, 200);
    const now = Date.now();
    return this.queue.slice(0, n).map((item) => {
      const enqueuedMs = Date.parse(item.enqueuedAt);
      const waitMs = Number.isFinite(enqueuedMs) ? Math.max(0, now - enqueuedMs) : 0;
      return {
        taskId: item.task.id,
        taskName: item.task.name,
        trigger: item.trigger,
        enqueuedAt: item.enqueuedAt,
        waitMs
      };
    });
  }

  getSettings(): { maxConcurrentRuns: number; runningCount: number; queuedCount: number } {
    return {
      maxConcurrentRuns: this.maxConcurrentRuns,
      runningCount: this.running.size,
      queuedCount: this.queue.length
    };
  }

  updateSettings(patch: { maxConcurrentRuns?: number }): { maxConcurrentRuns: number; runningCount: number; queuedCount: number } {
    if (patch.maxConcurrentRuns !== undefined) {
      const parsed = parseBoundedNumber(patch.maxConcurrentRuns, 1, 16);
      if (parsed === undefined) {
        throw new Error("maxConcurrentRuns must be a number between 1 and 16");
      }
      this.maxConcurrentRuns = parsed;
      this.pumpQueue();
    }
    return this.getSettings();
  }

  async createTask(raw: CreateLoopTaskInput): Promise<LoopTask> {
    const normalized = normalizeTaskInput(raw);
    ensureValidNumericPatch(raw, normalized);
    if (!normalized.name) {
      throw new Error("name is required");
    }
    if (!normalized.prompt) {
      throw new Error("prompt is required");
    }
    this.ensureUniqueTaskName(normalized.name);
    if (normalized.intervalSec === undefined) {
      throw new Error("intervalSec is required");
    }
    if (normalized.runner === undefined) {
      throw new Error("runner is required");
    }

    const resolvedTaskCwd = normalized.cwd ? await this.inspectPath(normalized.cwd) : null;

    const now = nowIso();
    const workflow = ensureWorkflowList(normalized.workflow);
    const workflowSteps = ensureWorkflowSteps(normalized.workflowSteps, workflow);
    const workflowDefinitionProvided = normalized.workflow !== undefined || normalized.workflowSteps !== undefined;
    const hasWorkflowDefinition = workflow.length > 0 || workflowSteps.length > 0;
    const hasCommandFallback = Boolean(normalized.command);
    if (workflowDefinitionProvided && (hasWorkflowDefinition || !hasCommandFallback)) {
      ensureWorkflowHasEnabledSteps(workflowSteps);
    }
    await this.validateWorkflowStepPaths(workflowSteps, resolvedTaskCwd ? resolvedTaskCwd.runCwd : null);
    const workflowNewSessionPerStep = normalized.workflowNewSessionPerStep ?? !(normalized.workflowSharedSession ?? true);
    const workflowNewSessionPerRound = normalized.workflowNewSessionPerRound ?? !(normalized.workflowSharedSession ?? true);
    const task: LoopTask = {
      id: randomUUID(),
      name: normalized.name,
      runner: normalized.runner,
      prompt: normalized.prompt,
      workflow,
      workflowSteps,
      workflowCarryContext: normalized.workflowCarryContext ?? false,
      workflowLoopFromStart: normalized.workflowLoopFromStart ?? false,
      workflowNewSessionPerStep,
      workflowNewSessionPerRound,
      workflowSharedSession: !(workflowNewSessionPerStep || workflowNewSessionPerRound),
      workflowFullAccess: normalized.workflowFullAccess ?? false,
      workflowResumeStepIndex: null,
      workflowResumeUpdatedAt: null,
      workflowResumeReason: null,
      intervalSec: normalized.intervalSec,
      timeoutSec: 0,
      enabled: normalized.enabled ?? true,
      cwd: normalized.cwd ?? null,
      command: normalized.command ?? null,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null
    };
    this.tasks.set(task.id, task);
    await this.persistAndResync();
    return task;
  }

  async updateTask(taskId: string, patch: UpdateLoopTaskInput): Promise<LoopTask> {
    const current = this.tasks.get(taskId);
    if (!current) {
      throw new Error("task not found");
    }
    const normalized = normalizeTaskInput(patch);
    ensureValidNumericPatch(patch, normalized);
    let effectiveTaskRunCwd: string | null = null;
    if (normalized.cwd !== undefined) {
      if (normalized.cwd) {
        const inspected = await this.inspectPath(normalized.cwd);
        effectiveTaskRunCwd = inspected.runCwd;
      }
    } else if (current.cwd) {
      const inspected = await this.inspectPath(current.cwd);
      effectiveTaskRunCwd = inspected.runCwd;
    }
    const workflow = normalized.workflow === undefined
      ? current.workflow
      : ensureWorkflowList(normalized.workflow);
    const workflowSteps = normalized.workflowSteps === undefined
      ? (
        normalized.workflow === undefined
          ? ensureWorkflowSteps(current.workflowSteps, workflow)
          : ensureWorkflowSteps(undefined, workflow)
      )
      : ensureWorkflowSteps(normalized.workflowSteps, workflow);
    const workflowInputProvided = normalized.workflow !== undefined || normalized.workflowSteps !== undefined;
    const hasWorkflowDefinition = workflow.length > 0 || workflowSteps.length > 0;
    const hasCommandFallback = normalized.command !== undefined
      ? Boolean(normalized.command)
      : Boolean(current.command);
    const workflowDefinitionChanged = workflowInputProvided
      && !isWorkflowDefinitionEqual(current.workflow, current.workflowSteps, workflow, workflowSteps);
    if (workflowInputProvided && (hasWorkflowDefinition || !hasCommandFallback)) {
      ensureWorkflowHasEnabledSteps(workflowSteps);
    }
    const workflowLoopFromStart = normalized.workflowLoopFromStart === undefined
      ? current.workflowLoopFromStart
      : (parseOptionalBoolean(normalized.workflowLoopFromStart) ?? current.workflowLoopFromStart);
    const workflowNewSessionPerStep = normalized.workflowNewSessionPerStep === undefined
      ? current.workflowNewSessionPerStep
      : (parseOptionalBoolean(normalized.workflowNewSessionPerStep) ?? current.workflowNewSessionPerStep);
    const workflowNewSessionPerRound = normalized.workflowNewSessionPerRound === undefined
      ? current.workflowNewSessionPerRound
      : (parseOptionalBoolean(normalized.workflowNewSessionPerRound) ?? current.workflowNewSessionPerRound);
    const workflowSharedSession = normalized.workflowSharedSession === undefined
      ? !(workflowNewSessionPerStep || workflowNewSessionPerRound)
      : (parseOptionalBoolean(normalized.workflowSharedSession) ?? !(workflowNewSessionPerStep || workflowNewSessionPerRound));
    const workflowFullAccess = normalized.workflowFullAccess === undefined
      ? current.workflowFullAccess
      : (parseOptionalBoolean(normalized.workflowFullAccess) ?? current.workflowFullAccess);
    await this.validateWorkflowStepPaths(workflowSteps, effectiveTaskRunCwd);

    const next: LoopTask = {
      ...current,
      ...normalized,
      workflow,
      workflowSteps,
      workflowCarryContext: normalized.workflowCarryContext ?? current.workflowCarryContext,
      workflowLoopFromStart,
      workflowNewSessionPerStep,
      workflowNewSessionPerRound,
      workflowSharedSession,
      workflowFullAccess,
      updatedAt: nowIso()
    };
    if (workflowDefinitionChanged) {
      next.workflowResumeStepIndex = null;
      next.workflowResumeUpdatedAt = null;
      next.workflowResumeReason = null;
    }

    if (!next.name) {
      throw new Error("name cannot be empty");
    }
    this.ensureUniqueTaskName(next.name, taskId);
    if (!next.prompt) {
      throw new Error("prompt cannot be empty");
    }

    this.tasks.set(taskId, next);
    if (!next.enabled) {
      this.removeQueuedRuns(taskId);
    } else {
      this.replaceQueuedTask(next);
    }
    await this.persistAndResync();
    return next;
  }

  async toggleTask(taskId: string): Promise<LoopTask> {
    const current = this.tasks.get(taskId);
    if (!current) {
      throw new Error("task not found");
    }
    const next: LoopTask = {
      ...current,
      enabled: !current.enabled,
      updatedAt: nowIso()
    };
    this.tasks.set(taskId, next);
    if (!next.enabled) {
      this.removeQueuedRuns(taskId);
    } else {
      this.replaceQueuedTask(next);
    }
    await this.persistAndResync();
    return next;
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!this.tasks.has(taskId)) {
      throw new Error("task not found");
    }
    this.stopTask(taskId, "task deleted");
    this.tasks.delete(taskId);
    this.removeQueuedRuns(taskId);
    await this.persistAndResync();
  }

  stopTask(
    taskId: string,
    reason = "task stopped manually",
    options?: { afterRound?: boolean }
  ): { running: boolean; queued: number; deferred: boolean } {
    const queued = this.removeQueuedRuns(taskId, reason);
    const running = this.cancelRunningTask(taskId, reason, options);
    const deferred = Boolean(options && options.afterRound && running && this.tasks.get(taskId)?.workflowLoopFromStart);
    return { running, queued, deferred };
  }

  private cancelRunningTask(taskId: string, reason: string, options?: { afterRound?: boolean }): boolean {
    const control = this.runningControls.get(taskId);
    if (!control) {
      return false;
    }
    if (options && options.afterRound && this.tasks.get(taskId)?.workflowLoopFromStart) {
      control.stopAfterRoundReason = reason;
      return true;
    }
    control.cancelReason = reason;
    const child = control.child;
    const runId = control.runId;
    if (child) {
      try {
        killChildProcessTree(child.pid, "SIGTERM");
      } catch {}
      setTimeout(() => {
        const current = this.runningControls.get(taskId);
        if (!current || current.runId !== runId || current.child !== child) {
          return;
        }
        try {
          killChildProcessTree(child.pid, "SIGKILL");
        } catch {}
      }, 2000);
    }
    return true;
  }

  async runNow(taskId: string, options?: { executionOverrides?: LoopRuntimeExecutionOverrides }): Promise<LoopRun> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error("task not found");
    }
    return this.runTask(task, "manual", {
      persistTaskState: true,
      recordRun: true,
      restartIfRunning: true,
      executionOverrides: options?.executionOverrides
    });
  }

  async resumeNow(
    taskId: string,
    stepIndex?: number | null,
    options?: { executionOverrides?: LoopRuntimeExecutionOverrides }
  ): Promise<LoopRun> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error("task not found");
    }
    const resolvedStepIndex = this.resolveResumeStepIndex(taskId, stepIndex);
    return this.runTask(task, "manual", {
      persistTaskState: true,
      recordRun: true,
      restartIfRunning: true,
      resumeStepIndex: resolvedStepIndex,
      executionOverrides: options?.executionOverrides
    });
  }

  hasTask(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  resolveResumeStepIndex(taskId: string, stepIndex?: number | null): number {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error("task not found");
    }
    const resolvedStepIndex = stepIndex == null
      ? task.workflowResumeStepIndex
      : normalizeOptionalPositiveInt(stepIndex);
    if (resolvedStepIndex == null) {
      throw new Error("resume checkpoint not found");
    }
    return resolvedStepIndex;
  }

  async testTask(
    raw: CreateLoopTaskInput,
    options?: { executionOverrides?: LoopRuntimeExecutionOverrides }
  ): Promise<LoopRun> {
    const normalized = normalizeTaskInput(raw);
    ensureValidNumericPatch(raw, normalized);
    if (!normalized.prompt) {
      throw new Error("prompt is required");
    }
    if (normalized.runner === undefined) {
      throw new Error("runner is required");
    }
    const resolvedTaskCwd = normalized.cwd ? await this.inspectPath(normalized.cwd) : null;

    const now = nowIso();
    const workflow = ensureWorkflowList(normalized.workflow);
    const workflowSteps = ensureWorkflowSteps(normalized.workflowSteps, workflow);
    const workflowDefinitionProvided = normalized.workflow !== undefined || normalized.workflowSteps !== undefined;
    const hasWorkflowDefinition = workflow.length > 0 || workflowSteps.length > 0;
    const hasCommandFallback = Boolean(normalized.command);
    if (workflowDefinitionProvided && (hasWorkflowDefinition || !hasCommandFallback)) {
      ensureWorkflowHasEnabledSteps(workflowSteps);
    }
    await this.validateWorkflowStepPaths(workflowSteps, resolvedTaskCwd ? resolvedTaskCwd.runCwd : null);
    const workflowNewSessionPerStep = normalized.workflowNewSessionPerStep ?? !(normalized.workflowSharedSession ?? true);
    const workflowNewSessionPerRound = normalized.workflowNewSessionPerRound ?? !(normalized.workflowSharedSession ?? true);
    const previewTask: LoopTask = {
      id: randomUUID(),
      name: normalized.name || "preview",
      runner: normalized.runner,
      prompt: normalized.prompt,
      workflow,
      workflowSteps,
      workflowCarryContext: normalized.workflowCarryContext ?? false,
      workflowLoopFromStart: normalized.workflowLoopFromStart ?? false,
      workflowNewSessionPerStep,
      workflowNewSessionPerRound,
      workflowSharedSession: !(workflowNewSessionPerStep || workflowNewSessionPerRound),
      workflowFullAccess: normalized.workflowFullAccess ?? false,
      workflowResumeStepIndex: null,
      workflowResumeUpdatedAt: null,
      workflowResumeReason: null,
      intervalSec: clamp(normalized.intervalSec ?? 300, 5, 86400),
      timeoutSec: 0,
      enabled: true,
      cwd: normalized.cwd ?? null,
      command: normalized.command ?? null,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null
    };

    return this.runTask(previewTask, "manual", {
      persistTaskState: false,
      recordRun: false,
      executionOverrides: options?.executionOverrides
    });
  }

  async inspectPath(rawPath: string): Promise<{ path: string; kind: "directory" | "file"; runCwd: string; promptHint: string | null }> {
    return this.runtime.inspectPath(rawPath, null);
  }

  private async validateWorkflowStepPaths(workflowSteps: WorkflowStep[], taskRunCwd: string | null): Promise<void> {
    await this.runtime.validateWorkflowStepPaths(workflowSteps, taskRunCwd);
  }

  private async persistAndResync(): Promise<void> {
    await this.store.save(this.listTasks());
    this.syncTimers();
  }

  private syncTimers(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();

    for (const task of this.tasks.values()) {
      if (!task.enabled) {
        continue;
      }
      const intervalMs = clamp(task.intervalSec, 5, 86400) * 1000;
      const timer = setInterval(() => {
        void this.runTask(task, "timer", { persistTaskState: true, recordRun: true });
      }, intervalMs);
      this.timers.set(task.id, timer);
    }
  }

  private runTask(task: LoopTask, trigger: "timer" | "manual", options: RunTaskOptions): Promise<LoopRun> {
    return new Promise<LoopRun>((resolveRun) => {
      const skipOnTimerConflict = shouldSilentlySkipTimerConflict(trigger, options.restartIfRunning);
      if (hasNoEnabledWorkflowSteps(task)) {
        const now = nowIso();
        const run = createImmediateRun({
          runId: randomUUID(),
          now,
          task,
          trigger,
          status: "failed",
          error: "no enabled workflow steps"
        });
        if (options.recordRun) {
          this.pushRun(run);
        }
        resolveRun(run);
        return;
      }
      if (this.running.has(task.id)) {
        if (options.restartIfRunning) {
          this.cancelRunningTask(task.id, "task restarted manually");
          const existingQueued = findQueuedRunByTaskId(this.queue, task.id);
          if (existingQueued) {
            existingQueued.resolveRuns.push(resolveRun);
            return;
          }
        } else if (skipOnTimerConflict) {
          const now = nowIso();
          resolveRun(createImmediateRun({
            runId: randomUUID(),
            now,
            task,
            trigger,
            status: "cancelled",
            error: "task already running (timer skipped)"
          }));
          return;
        } else {
          const now = nowIso();
          const run = createImmediateRun({
            runId: randomUUID(),
            now,
            task,
            trigger,
            status: "failed",
            error: "task is already running"
          });
          if (options.recordRun) {
            this.pushRun(run);
          }
          resolveRun(run);
          return;
        }
      }
      if (this.queue.some((item) => item.task.id === task.id)) {
        if (options.restartIfRunning) {
          const existingQueued = findQueuedRunByTaskId(this.queue, task.id);
          if (existingQueued) {
            existingQueued.resolveRuns.push(resolveRun);
            return;
          }
        } else if (skipOnTimerConflict) {
          const now = nowIso();
          resolveRun(createImmediateRun({
            runId: randomUUID(),
            now,
            task,
            trigger,
            status: "cancelled",
            error: "task already queued (timer skipped)"
          }));
          return;
        } else {
          const now = nowIso();
          const run = createImmediateRun({
            runId: randomUUID(),
            now,
            task,
            trigger,
            status: "failed",
            error: "task is already queued"
          });
          if (options.recordRun) {
            this.pushRun(run);
          }
          resolveRun(run);
          return;
        }
      }
      this.queue.push({
        task,
        trigger,
        options,
        enqueuedAt: nowIso(),
        resolveRuns: [resolveRun]
      });
      this.pumpQueue();
    });
  }

  private pumpQueue(): void {
    while (this.running.size < this.maxConcurrentRuns) {
      const nextIdx = this.queue.findIndex((item) => !this.running.has(item.task.id));
      if (nextIdx < 0) {
        return;
      }
      const [next] = this.queue.splice(nextIdx, 1);
      this.executeRun(next);
    }
  }

  private removeQueuedRuns(taskId: string, reason = "task removed from queue"): number {
    let removed = 0;
    for (let i = this.queue.length - 1; i >= 0; i -= 1) {
      if (this.queue[i].task.id === taskId) {
        const item = this.queue.splice(i, 1)[0];
        removed += 1;
        const failedRun: LoopRun = {
          id: randomUUID(),
          taskId,
          taskName: item.task.name,
          runner: item.task.runner,
          trigger: item.trigger,
          startedAt: nowIso(),
          endedAt: nowIso(),
          durationMs: 0,
          status: "failed",
          exitCode: null,
          stdout: "",
          stderr: "",
          error: reason
        };
        for (const resolveRun of item.resolveRuns) {
          resolveRun(failedRun);
        }
      }
    }
    return removed;
  }

  private replaceQueuedTask(task: LoopTask): void {
    for (const item of this.queue) {
      if (item.task.id === task.id) {
        item.task = task;
      }
    }
  }

  private ensureUniqueTaskName(name: string, excludeTaskId?: string): void {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) {
      return;
    }
    for (const task of this.tasks.values()) {
      if (excludeTaskId && task.id === excludeTaskId) {
        continue;
      }
      if (String(task.name || "").trim().toLowerCase() === normalized) {
        throw new Error(`task name already exists: ${name}`);
      }
    }
  }

  private executeRun(queued: QueuedRun): void {
    const { task, trigger, options, resolveRuns } = queued;
    const runId = randomUUID();
    const control: RunningTaskControl = {
      runId,
      cancelReason: null,
      stopAfterRoundReason: null,
      child: null
    };
    this.running.add(task.id);
    this.runningControls.set(task.id, control);
    const startedAt = nowIso();
    const started = Date.now();
    this.liveRunState.init(runId, task, trigger, startedAt);
    this.liveRunState.pushEvent(runId, "info", "task started");
    void (async () => {
        const steps = task.workflowSteps && task.workflowSteps.length > 0
          ? task.workflowSteps.filter((item) => item.enabled !== false)
          : [{ name: "default", enabled: true }];
        if (steps.length === 0) {
          this.liveRunState.pushEvent(runId, "error", "no enabled workflow steps");
          const failed: LoopRun = {
            id: runId,
            taskId: task.id,
            taskName: task.name,
            runner: task.runner,
            trigger,
            startedAt,
            endedAt: nowIso(),
            durationMs: Date.now() - started,
            status: "failed",
            exitCode: null,
            stdout: "",
            stderr: "",
            error: "no enabled workflow steps"
          };
          if (options.recordRun) {
            this.pushRun(failed);
          }
          this.liveRunState.clear(runId);
          this.running.delete(task.id);
          this.runningControls.delete(task.id);
          this.pumpQueue();
          for (const resolveRun of resolveRuns) {
            resolveRun(failed);
          }
          return;
        }
        const requestedResumeStep = normalizeOptionalPositiveInt(options.resumeStepIndex);
        const initialStepIdx = requestedResumeStep == null ? 0 : (requestedResumeStep - 1);
        if (initialStepIdx < 0 || initialStepIdx >= steps.length) {
          const failed: LoopRun = {
            id: runId,
            taskId: task.id,
            taskName: task.name,
            runner: task.runner,
            trigger,
            startedAt,
            endedAt: nowIso(),
            durationMs: Date.now() - started,
            status: "failed",
            exitCode: null,
            stdout: "",
            stderr: "",
            error: `invalid resume step index: ${requestedResumeStep}; enabled step count=${steps.length}`
          };
          this.liveRunState.pushEvent(runId, "error", failed.error || "invalid resume step index");
          if (options.recordRun) {
            this.pushRun(failed);
          }
          this.liveRunState.clear(runId);
          this.running.delete(task.id);
          this.runningControls.delete(task.id);
          this.pumpQueue();
          for (const resolveRun of resolveRuns) {
            resolveRun(failed);
          }
          return;
        }
        this.liveRunState.setPhase(runId, "running");
        this.liveRunState.setStep(runId, 1, initialStepIdx + 1, steps.length, null);
        let execution;
        try {
          execution = await this.runtime.executeTask({
            task: {
              id: task.id,
              runner: task.runner,
              prompt: task.prompt,
              command: task.command,
              workflowSteps: steps,
              workflowCarryContext: task.workflowCarryContext,
              workflowLoopFromStart: task.workflowLoopFromStart,
              workflowNewSessionPerStep: task.workflowNewSessionPerStep,
              workflowNewSessionPerRound: task.workflowNewSessionPerRound,
              workflowSharedSession: task.workflowSharedSession,
              workflowFullAccess: task.workflowFullAccess
            },
            cwdInput: task.cwd,
            initialStepIndex: initialStepIdx,
            runCommand: options.executionOverrides?.runCommand,
            runModel: options.executionOverrides?.runModel,
            runTool: options.executionOverrides?.runTool,
            resolveStepContext: options.executionOverrides?.resolveStepContext,
            onCommandSpawn: (child) => {
              const current = this.runningControls.get(task.id);
              if (current && current.runId === runId) {
                current.child = child;
                if (current.cancelReason) {
                  try {
                    child.kill("SIGTERM");
                  } catch {}
                }
              }
            },
            callbacks: {
              onEvent: (level, message) => this.liveRunState.pushEvent(runId, level, message),
              onStepChange: (round, stepIndex, totalSteps, stepName) => {
                this.liveRunState.setStep(runId, round, stepIndex, totalSteps, stepName);
              },
              onOutput: (stream, chunk) => {
                this.liveRunState.appendOutput(runId, stream, chunk);
              },
              onHeartbeat: () => {
                this.liveRunState.touch(runId);
              },
              isCancelled: () => {
                const current = this.runningControls.get(task.id);
                if (!current || current.runId !== runId) {
                  return null;
                }
                return current.cancelReason;
              },
              stopAfterRoundReason: () => {
                const current = this.runningControls.get(task.id);
                if (!current || current.runId !== runId) {
                  return null;
                }
                return current.stopAfterRoundReason;
              }
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const isPathContextError = /^path (is required|not found:|must be a directory or file:)/.test(message);
          const failed: LoopRun = {
            id: runId,
            taskId: task.id,
            taskName: task.name,
            runner: task.runner,
            trigger,
            startedAt,
            endedAt: nowIso(),
            durationMs: Date.now() - started,
            status: "failed",
            exitCode: null,
            stdout: "",
            stderr: "",
            error: isPathContextError ? message : `unexpected scheduler error: ${message}`
          };
          this.liveRunState.pushEvent(runId, "error", message);
          if (options.recordRun) {
            this.pushRun(failed);
          }
          this.liveRunState.clear(runId);
          this.running.delete(task.id);
          this.runningControls.delete(task.id);
          this.pumpQueue();
          for (const resolveRun of resolveRuns) {
            resolveRun(failed);
          }
          return;
        }
        const finalStatus = execution.status;
        const finalExitCode = execution.exitCode;
        const finalError = execution.error;
        const firstFailure = execution.firstFailure;

        const endedAt = nowIso();
        this.liveRunState.setPhase(runId, "finishing");
        this.liveRunState.pushEvent(runId, finalStatus === "success" ? "info" : "error", `task finished with ${finalStatus}`);
        const run: LoopRun = {
          id: runId,
          taskId: task.id,
          taskName: task.name,
          runner: task.runner,
          trigger,
          startedAt,
          endedAt,
          durationMs: Date.now() - started,
          status: finalStatus,
          exitCode: finalExitCode,
          stdout: execution.stdout,
          stderr: execution.stderr,
          error: finalError
        };

        if (options.recordRun) {
          this.pushRun(run);
        }
        if (options.persistTaskState) {
          const current = this.tasks.get(task.id);
          if (current) {
            const checkpointStepIndex = firstFailure && (finalStatus === "failed" || finalStatus === "cancelled")
              ? firstFailure.stepIndex
              : null;
            const checkpointReason = checkpointStepIndex
              ? (
                finalStatus === "failed"
                  ? (finalError || "workflow step failed")
                  : `stopped after current round; first failure at round ${firstFailure!.round}, step ${firstFailure!.stepIndex}/${firstFailure!.stepCount} (${firstFailure!.stepName})`
                    + (firstFailure!.result.error ? `: ${firstFailure!.result.error}` : "")
              )
              : null;
            const updated: LoopTask = {
              ...current,
              lastRunAt: endedAt,
              updatedAt: nowIso(),
              workflowResumeStepIndex: checkpointStepIndex,
              workflowResumeUpdatedAt: checkpointStepIndex ? endedAt : null,
              workflowResumeReason: checkpointReason
            };
            this.tasks.set(task.id, updated);
            try {
              await this.store.save(this.listTasks());
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              run.stderr = `${run.stderr}\n[persist] save failed: ${message}`.slice(0, 20000);
            }
          }
        }

        this.liveRunState.clear(runId);
        this.running.delete(task.id);
        this.runningControls.delete(task.id);
        this.pumpQueue();
        for (const resolveRun of resolveRuns) {
          resolveRun(run);
        }
      })().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        const failed: LoopRun = {
          id: runId,
          taskId: task.id,
          taskName: task.name,
          runner: task.runner,
          trigger,
          startedAt,
          endedAt: nowIso(),
          durationMs: Date.now() - started,
          status: "failed",
          exitCode: null,
          stdout: "",
          stderr: "",
          error: `unexpected scheduler error: ${message}`
        };
        if (options.recordRun) {
          this.pushRun(failed);
        }
        this.liveRunState.clear(runId);
        this.running.delete(task.id);
        this.runningControls.delete(task.id);
        this.pumpQueue();
        for (const resolveRun of resolveRuns) {
          resolveRun(failed);
        }
      });
  }

  private pushRun(run: LoopRun): void {
    this.runs.unshift(run);
    if (this.runs.length > 200) {
      this.runs.length = 200;
    }
  }
}

function killChildProcessTree(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid || pid <= 0) {
    return;
  }
  try {
    process.kill(-pid, signal);
    return;
  } catch {
    // fall through: group signal may fail if process already exited
  }
  try {
    process.kill(pid, signal);
  } catch {
    // ignore kill failure and let scheduler state settle naturally
  }
}
