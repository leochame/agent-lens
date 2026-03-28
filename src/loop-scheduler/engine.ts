import { randomUUID } from "node:crypto";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { LoopTaskStore } from "./store";
import {
  CreateLoopTaskInput,
  LoopRun,
  LoopRunLive,
  LoopRunLiveEvent,
  LoopRunner,
  LoopTask,
  UpdateLoopTaskInput,
  WorkflowStep
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseBoundedNumber(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return clamp(n, min, max);
}

function normalizeIsoOrFallback(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    return fallback;
  }
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) {
    return fallback;
  }
  return new Date(ms).toISOString();
}

function normalizeOptionalIso(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

function ensureValidNumericPatch(
  raw: CreateLoopTaskInput | UpdateLoopTaskInput,
  normalized: UpdateLoopTaskInput
): void {
  if (raw.intervalSec !== undefined && normalized.intervalSec === undefined) {
    throw new Error("intervalSec must be a number between 5 and 86400");
  }
}

function normalizeRunner(value: unknown): LoopRunner {
  if (value === "claude_code" || value === "codex" || value === "custom") {
    return value;
  }
  return "custom";
}

function normalizeTaskInput(raw: CreateLoopTaskInput | UpdateLoopTaskInput): UpdateLoopTaskInput {
  const next: UpdateLoopTaskInput = {};
  if (raw.name !== undefined) {
    next.name = String(raw.name ?? "").trim();
  }
  if (raw.prompt !== undefined) {
    next.prompt = String(raw.prompt ?? "").trim();
  }
  if (raw.workflow !== undefined) {
    const value = raw.workflow;
    const list = Array.isArray(value)
      ? value
      : String(value ?? "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
    next.workflow = list;
  }
  if (raw.workflowSteps !== undefined) {
    const value = raw.workflowSteps;
    if (Array.isArray(value)) {
      next.workflowSteps = value;
    } else {
      next.workflowSteps = String(value ?? "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
    }
  }
  if (raw.workflowCarryContext !== undefined) {
    // Legacy no-op: workflowCarryContext is accepted for backward compatibility, but context carry is disabled.
  }
  if (raw.workflowLoopFromStart !== undefined) {
    const value = parseOptionalBoolean(raw.workflowLoopFromStart);
    if (value !== undefined) {
      next.workflowLoopFromStart = value;
    }
  }
  if (raw.workflowSharedSession !== undefined) {
    const value = parseOptionalBoolean(raw.workflowSharedSession);
    if (value !== undefined) {
      next.workflowSharedSession = value;
    }
  }
  if (raw.workflowFullAccess !== undefined) {
    const value = parseOptionalBoolean(raw.workflowFullAccess);
    if (value !== undefined) {
      next.workflowFullAccess = value;
    }
  }
  if (raw.runner !== undefined) {
    next.runner = normalizeRunner(raw.runner);
  }
  if (raw.intervalSec !== undefined) {
    const parsed = parseBoundedNumber(raw.intervalSec, 5, 86400);
    if (parsed !== undefined) {
      next.intervalSec = parsed;
    }
  }
  if (raw.timeoutSec !== undefined) {
    // Legacy no-op: timeoutSec is accepted for backward compatibility, but loop tasks do not enforce timeouts.
  }
  if (raw.enabled !== undefined) {
    const value = parseOptionalBoolean(raw.enabled);
    if (value !== undefined) {
      next.enabled = value;
    }
  }
  if (raw.cwd !== undefined) {
    const value = raw.cwd == null ? null : String(raw.cwd).trim();
    next.cwd = value ? value : null;
  }
  if (raw.command !== undefined) {
    const value = raw.command == null ? null : String(raw.command).trim();
    next.command = value ? value : null;
  }
  return next;
}

function buildCommand(runner: LoopRunner, command: string | null | undefined, prompt: string, fullAccess = false): string {
  if (command) {
    return interpolatePromptTemplate(command, prompt);
  }
  if (runner === "claude_code") {
    return `claude -p ${shellQuoteArg(prompt)}`;
  }
  if (runner === "codex") {
    const accessFlag = fullAccess
      ? "--dangerously-bypass-approvals-and-sandbox"
      : "--full-auto";
    return `codex exec ${accessFlag} ${shellQuoteArg(prompt)}`;
  }
  return "";
}

function interpolatePromptTemplate(commandTemplate: string, prompt: string): string {
  const quotedPrompt = shellQuoteArg(prompt);
  return String(commandTemplate)
    .replaceAll('"{prompt}"', quotedPrompt)
    .replaceAll("'{prompt}'", quotedPrompt)
    .replaceAll("{prompt}", quotedPrompt);
}

function normalizeSpace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isDefaultCodexTemplate(command: string | null | undefined): boolean {
  if (!command) {
    return false;
  }
  const normalized = normalizeSpace(command);
  return normalized === 'codex exec "{prompt}"'
    || normalized === 'codex exec --full-auto "{prompt}"'
    || normalized === 'codex exec --dangerously-bypass-approvals-and-sandbox "{prompt}"';
}

function shouldUseManagedCodexSession(
  task: LoopTask,
  step: WorkflowStep,
  effectiveRunner: LoopRunner
): boolean {
  if (!task.workflowSharedSession) {
    return false;
  }
  if (effectiveRunner === "codex" && !step.command && !task.command) {
    return true;
  }
  const candidate = step.command ?? task.command ?? null;
  return isDefaultCodexTemplate(candidate);
}

function buildManagedCodexCommand(prompt: string, resume: boolean, fullAccess: boolean): string {
  const accessFlag = fullAccess
    ? "--dangerously-bypass-approvals-and-sandbox"
    : "--full-auto";
  if (resume) {
    return `codex exec resume --last --all ${accessFlag} --skip-git-repo-check ${shellQuoteArg(prompt)}`;
  }
  return `codex exec ${accessFlag} --skip-git-repo-check ${shellQuoteArg(prompt)}`;
}

function codexSessionHomeForTask(taskId: string): string {
  return join(process.cwd(), ".agentlens", "codex-sessions", taskId);
}

function buildTaskPrompt(basePrompt: string, stepText: string, stepIndex: number, stepCount: number): string {
  const stepTitle = `[Step ${stepIndex + 1}/${stepCount}] ${stepText}`;
  const cleanBase = normalizePrompt(basePrompt);
  if (!cleanBase) {
    return stepTitle;
  }
  return `${cleanBase}\n\n${stepTitle}`;
}

function ensureWorkflowList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true" || text === "1" || text === "yes" || text === "on") {
      return true;
    }
    if (text === "false" || text === "0" || text === "no" || text === "off" || text === "") {
      return false;
    }
  }
  return undefined;
}

function ensureWorkflowSteps(
  stepsValue: WorkflowStep[] | string | undefined,
  workflowFallback: string[]
): WorkflowStep[] {
  if (Array.isArray(stepsValue)) {
    return stepsValue
      .map((step) => {
        const continueOnError = parseOptionalBoolean(step && step.continueOnError);
        const enabled = parseOptionalBoolean(step && step.enabled);
        return {
          name: String(step && step.name ? step.name : "").trim(),
          runner: step && step.runner ? normalizeRunner(step.runner) : undefined,
          cwd: step && step.cwd != null ? String(step.cwd).trim() || null : undefined,
          command: step && step.command != null ? String(step.command).trim() || null : undefined,
          promptAppend: step && step.promptAppend ? String(step.promptAppend).trim() : undefined,
          timeoutSec: undefined,
          continueOnError: continueOnError ?? false,
          enabled: enabled ?? true
        };
      })
      .filter((step) => step.name);
  }
  if (typeof stepsValue === "string" && stepsValue.trim()) {
    return stepsValue
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name, enabled: true, continueOnError: false }));
  }
  return workflowFallback.map((name) => ({ name, enabled: true, continueOnError: false }));
}

function ensureWorkflowHasEnabledSteps(workflowSteps: WorkflowStep[]): void {
  if (workflowSteps.length > 0 && workflowSteps.every((step) => step.enabled === false)) {
    throw new Error("workflow must have at least one enabled step");
  }
}

function hasNoEnabledWorkflowSteps(task: LoopTask): boolean {
  return Array.isArray(task.workflowSteps)
    && task.workflowSteps.length > 0
    && task.workflowSteps.every((step) => step.enabled === false);
}

function normalizeLoadedTask(raw: LoopTask): LoopTask {
  const now = nowIso();
  const workflow = ensureWorkflowList((raw as Partial<LoopTask>).workflow as string[] | string | undefined);
  const workflowSteps = ensureWorkflowSteps((raw as Partial<LoopTask>).workflowSteps, workflow);
  const workflowLoopFromStart = parseOptionalBoolean((raw as Partial<LoopTask>).workflowLoopFromStart);
  const workflowSharedSession = parseOptionalBoolean((raw as Partial<LoopTask>).workflowSharedSession);
  const workflowFullAccess = parseOptionalBoolean((raw as Partial<LoopTask>).workflowFullAccess);
  const intervalSec = parseBoundedNumber((raw as Partial<LoopTask>).intervalSec, 5, 86400) ?? 300;
  const timeoutSec = 0;
  const enabled = parseOptionalBoolean((raw as Partial<LoopTask>).enabled) ?? true;
  const runner = normalizeRunner((raw as Partial<LoopTask>).runner);
  const cwdRaw = (raw as Partial<LoopTask>).cwd;
  const commandRaw = (raw as Partial<LoopTask>).command;
  return {
    ...raw,
    runner,
    intervalSec,
    timeoutSec,
    enabled,
    cwd: cwdRaw == null ? null : String(cwdRaw).trim() || null,
    command: commandRaw == null ? null : String(commandRaw).trim() || null,
    createdAt: normalizeIsoOrFallback((raw as Partial<LoopTask>).createdAt, now),
    updatedAt: normalizeIsoOrFallback((raw as Partial<LoopTask>).updatedAt, now),
    lastRunAt: normalizeOptionalIso((raw as Partial<LoopTask>).lastRunAt),
    workflow,
    workflowSteps,
    workflowCarryContext: false,
    workflowLoopFromStart: workflowLoopFromStart ?? false,
    workflowSharedSession: workflowSharedSession ?? true,
    workflowFullAccess: workflowFullAccess ?? false
  };
}

function normalizePrompt(prompt: string): string {
  return String(prompt ?? "").trim();
}

function shellQuoteArg(value: string): string {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

async function resolveExecutionContext(
  cwdInput: string | null,
  prompt: string,
  baseCwd?: string
): Promise<{ cwd: string; prompt: string }> {
  const cleanPrompt = normalizePrompt(prompt);
  if (!cwdInput) {
    return { cwd: process.cwd(), prompt: cleanPrompt };
  }

  const targetPath = baseCwd && !isAbsolute(cwdInput) ? resolve(baseCwd, cwdInput) : resolve(cwdInput);
  let details;
  try {
    details = await stat(targetPath);
  } catch {
    throw new Error(`path not found: ${targetPath}`);
  }

  if (details.isDirectory()) {
    return { cwd: targetPath, prompt: cleanPrompt };
  }
  if (details.isFile()) {
    return {
      cwd: dirname(targetPath),
      prompt: `${cleanPrompt}\n\nFocus file: ${targetPath}`
    };
  }
  throw new Error(`path must be a directory or file: ${targetPath}`);
}

type RunTaskOptions = {
  persistTaskState: boolean;
  recordRun: boolean;
  restartIfRunning?: boolean;
};

type QueuedRun = {
  task: LoopTask;
  trigger: "timer" | "manual";
  options: RunTaskOptions;
  enqueuedAt: string;
  resolveRuns: Array<(run: LoopRun) => void>;
};

type CommandExecutionResult = {
  status: "success" | "failed" | "timeout" | "cancelled";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error: string | null;
};

type FirstFailureInfo = {
  result: CommandExecutionResult;
  round: number;
  stepIndex: number;
  stepCount: number;
  stepName: string;
};

type StreamChunkListener = (stream: "stdout" | "stderr", chunk: string) => void;
type HeartbeatListener = () => void;

const LIVE_EVENT_LIMIT = 120;
const LIVE_OUTPUT_TAIL_LIMIT = 5000;
const LIVE_HEARTBEAT_STALE_SEC = 30;

type RunningTaskControl = {
  runId: string;
  cancelReason: string | null;
  child: ChildProcessWithoutNullStreams | null;
};

export class LoopScheduler {
  private readonly store: LoopTaskStore;
  private readonly tasks: Map<string, LoopTask> = new Map();
  private readonly timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly running: Set<string> = new Set();
  private readonly runningControls: Map<string, RunningTaskControl> = new Map();
  private readonly runs: LoopRun[] = [];
  private readonly liveRuns: Map<string, LoopRunLive> = new Map();
  private readonly queue: QueuedRun[] = [];
  private maxConcurrentRuns = 4;

  constructor(storePath: string) {
    this.store = new LoopTaskStore(storePath);
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
    const n = clamp(limit, 1, 100);
    const now = Date.now();
    return Array.from(this.liveRuns.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, n)
      .map((item) => {
        const heartbeatMs = Date.parse(item.heartbeatAt);
        const silenceSec = Number.isFinite(heartbeatMs)
          ? Math.max(0, Math.floor((now - heartbeatMs) / 1000))
          : LIVE_HEARTBEAT_STALE_SEC + 1;
        return {
          ...item,
          silenceSec,
          heartbeatStale: silenceSec >= LIVE_HEARTBEAT_STALE_SEC,
          events: item.events.slice(-40)
        };
      });
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
    const workflowDefinitionChanged = normalized.workflow !== undefined || normalized.workflowSteps !== undefined;
    if (workflowDefinitionChanged) {
      ensureWorkflowHasEnabledSteps(workflowSteps);
    }
    await this.validateWorkflowStepPaths(workflowSteps, resolvedTaskCwd ? resolvedTaskCwd.runCwd : null);
    const task: LoopTask = {
      id: randomUUID(),
      name: normalized.name,
      runner: normalized.runner,
      prompt: normalized.prompt,
      workflow,
      workflowSteps,
      workflowCarryContext: false,
      workflowLoopFromStart: normalized.workflowLoopFromStart ?? false,
      workflowSharedSession: normalized.workflowSharedSession ?? true,
      workflowFullAccess: normalized.workflowFullAccess ?? false,
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
    const workflowDefinitionChanged = normalized.workflow !== undefined || normalized.workflowSteps !== undefined;
    if (workflowDefinitionChanged) {
      ensureWorkflowHasEnabledSteps(workflowSteps);
    }
    const workflowLoopFromStart = normalized.workflowLoopFromStart === undefined
      ? current.workflowLoopFromStart
      : (parseOptionalBoolean(normalized.workflowLoopFromStart) ?? current.workflowLoopFromStart);
    const workflowSharedSession = normalized.workflowSharedSession === undefined
      ? current.workflowSharedSession
      : (parseOptionalBoolean(normalized.workflowSharedSession) ?? current.workflowSharedSession);
    const workflowFullAccess = normalized.workflowFullAccess === undefined
      ? current.workflowFullAccess
      : (parseOptionalBoolean(normalized.workflowFullAccess) ?? current.workflowFullAccess);
    await this.validateWorkflowStepPaths(workflowSteps, effectiveTaskRunCwd);

    const next: LoopTask = {
      ...current,
      ...normalized,
      workflow,
      workflowSteps,
      workflowCarryContext: false,
      workflowLoopFromStart,
      workflowSharedSession,
      workflowFullAccess,
      updatedAt: nowIso()
    };

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

  stopTask(taskId: string, reason = "task stopped manually"): { running: boolean; queued: number } {
    const queued = this.removeQueuedRuns(taskId, reason);
    const running = this.cancelRunningTask(taskId, reason);
    return { running, queued };
  }

  private cancelRunningTask(taskId: string, reason: string): boolean {
    const control = this.runningControls.get(taskId);
    if (!control) {
      return false;
    }
    control.cancelReason = reason;
    const child = control.child;
    if (child) {
      try {
        child.kill("SIGTERM");
      } catch {}
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, 2000);
    }
    return true;
  }

  async runNow(taskId: string): Promise<LoopRun> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error("task not found");
    }
    return this.runTask(task, "manual", {
      persistTaskState: true,
      recordRun: true,
      restartIfRunning: true
    });
  }

  async testTask(raw: CreateLoopTaskInput): Promise<LoopRun> {
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
    ensureWorkflowHasEnabledSteps(workflowSteps);
    await this.validateWorkflowStepPaths(workflowSteps, resolvedTaskCwd ? resolvedTaskCwd.runCwd : null);
    const previewTask: LoopTask = {
      id: randomUUID(),
      name: normalized.name || "preview",
      runner: normalized.runner,
      prompt: normalized.prompt,
      workflow,
      workflowSteps,
      workflowCarryContext: false,
      workflowLoopFromStart: normalized.workflowLoopFromStart ?? false,
      workflowSharedSession: normalized.workflowSharedSession ?? true,
      workflowFullAccess: normalized.workflowFullAccess ?? false,
      intervalSec: clamp(normalized.intervalSec ?? 300, 5, 86400),
      timeoutSec: 0,
      enabled: true,
      cwd: normalized.cwd ?? null,
      command: normalized.command ?? null,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null
    };

    return this.runTask(previewTask, "manual", { persistTaskState: false, recordRun: false });
  }

  async inspectPath(rawPath: string): Promise<{ path: string; kind: "directory" | "file"; runCwd: string; promptHint: string | null }> {
    return this.inspectPathWithBase(rawPath, null);
  }

  private async inspectPathWithBase(
    rawPath: string,
    baseCwd: string | null
  ): Promise<{ path: string; kind: "directory" | "file"; runCwd: string; promptHint: string | null }> {
    const value = String(rawPath ?? "").trim();
    if (!value) {
      throw new Error("path is required");
    }

    const absolute = baseCwd && !isAbsolute(value) ? resolve(baseCwd, value) : resolve(value);
    let details;
    try {
      details = await stat(absolute);
    } catch {
      throw new Error(`path not found: ${absolute}`);
    }

    if (details.isDirectory()) {
      return { path: absolute, kind: "directory", runCwd: absolute, promptHint: null };
    }
    if (details.isFile()) {
      return {
        path: absolute,
        kind: "file",
        runCwd: dirname(absolute),
        promptHint: `Focus file: ${absolute}`
      };
    }
    throw new Error(`path must be a directory or file: ${absolute}`);
  }

  private async validateWorkflowStepPaths(workflowSteps: WorkflowStep[], taskRunCwd: string | null): Promise<void> {
    for (const step of workflowSteps) {
      const raw = step && step.cwd != null ? String(step.cwd).trim() : "";
      if (!raw) {
        continue;
      }
      try {
        await this.inspectPathWithBase(raw, taskRunCwd);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stepName = step.name ? String(step.name) : "(unnamed)";
        throw new Error(`workflow step "${stepName}" cwd invalid: ${message}`);
      }
    }
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
      const shouldSilentlySkipTimerConflict = trigger === "timer" && !options.restartIfRunning;
      if (hasNoEnabledWorkflowSteps(task)) {
        const run: LoopRun = {
          id: randomUUID(),
          taskId: task.id,
          taskName: task.name,
          runner: task.runner,
          trigger,
          startedAt: nowIso(),
          endedAt: nowIso(),
          durationMs: 0,
          status: "failed",
          exitCode: null,
          stdout: "",
          stderr: "",
          error: "no enabled workflow steps"
        };
        if (options.recordRun) {
          this.pushRun(run);
        }
        resolveRun(run);
        return;
      }
      if (this.running.has(task.id)) {
        if (options.restartIfRunning) {
          this.cancelRunningTask(task.id, "task restarted manually");
          const existingQueued = this.queue.find((item) => item.task.id === task.id);
          if (existingQueued) {
            existingQueued.resolveRuns.push(resolveRun);
            return;
          }
        } else if (shouldSilentlySkipTimerConflict) {
          resolveRun({
            id: randomUUID(),
            taskId: task.id,
            taskName: task.name,
            runner: task.runner,
            trigger,
            startedAt: nowIso(),
            endedAt: nowIso(),
            durationMs: 0,
            status: "cancelled",
            exitCode: null,
            stdout: "",
            stderr: "",
            error: "task already running (timer skipped)"
          });
          return;
        } else {
          const run: LoopRun = {
            id: randomUUID(),
            taskId: task.id,
            taskName: task.name,
            runner: task.runner,
            trigger,
            startedAt: nowIso(),
            endedAt: nowIso(),
            durationMs: 0,
            status: "failed",
            exitCode: null,
            stdout: "",
            stderr: "",
            error: "task is already running"
          };
          if (options.recordRun) {
            this.pushRun(run);
          }
          resolveRun(run);
          return;
        }
      }
      if (this.queue.some((item) => item.task.id === task.id)) {
        if (options.restartIfRunning) {
          const existingQueued = this.queue.find((item) => item.task.id === task.id);
          if (existingQueued) {
            existingQueued.resolveRuns.push(resolveRun);
            return;
          }
        } else if (shouldSilentlySkipTimerConflict) {
          resolveRun({
            id: randomUUID(),
            taskId: task.id,
            taskName: task.name,
            runner: task.runner,
            trigger,
            startedAt: nowIso(),
            endedAt: nowIso(),
            durationMs: 0,
            status: "cancelled",
            exitCode: null,
            stdout: "",
            stderr: "",
            error: "task already queued (timer skipped)"
          });
          return;
        } else {
          const run: LoopRun = {
            id: randomUUID(),
            taskId: task.id,
            taskName: task.name,
            runner: task.runner,
            trigger,
            startedAt: nowIso(),
            endedAt: nowIso(),
            durationMs: 0,
            status: "failed",
            exitCode: null,
            stdout: "",
            stderr: "",
            error: "task is already queued"
          };
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

  private initLiveRun(runId: string, task: LoopTask, trigger: "timer" | "manual", startedAt: string): void {
    this.liveRuns.set(runId, {
      id: runId,
      taskId: task.id,
      taskName: task.name,
      runner: task.runner,
      trigger,
      startedAt,
      heartbeatAt: startedAt,
      silenceSec: 0,
      heartbeatStale: false,
      phase: "preparing",
      round: 1,
      stepIndex: 0,
      totalSteps: 0,
      stepName: null,
      events: [],
      stdoutTail: "",
      stderrTail: ""
    });
  }

  private setLiveRunPhase(runId: string, phase: LoopRunLive["phase"]): void {
    const current = this.liveRuns.get(runId);
    if (!current) {
      return;
    }
    current.phase = phase;
    current.heartbeatAt = nowIso();
  }

  private setLiveRunStep(runId: string, round: number, stepIndex: number, totalSteps: number, stepName: string | null): void {
    const current = this.liveRuns.get(runId);
    if (!current) {
      return;
    }
    current.round = round;
    current.stepIndex = stepIndex;
    current.totalSteps = totalSteps;
    current.stepName = stepName;
    current.heartbeatAt = nowIso();
  }

  private pushLiveEvent(runId: string, level: LoopRunLiveEvent["level"], message: string): void {
    const current = this.liveRuns.get(runId);
    if (!current) {
      return;
    }
    current.events.push({
      at: nowIso(),
      level,
      message
    });
    if (current.events.length > LIVE_EVENT_LIMIT) {
      current.events.splice(0, current.events.length - LIVE_EVENT_LIMIT);
    }
    current.heartbeatAt = nowIso();
  }

  private appendLiveOutput(runId: string, stream: "stdout" | "stderr", chunk: string): void {
    const current = this.liveRuns.get(runId);
    if (!current || !chunk) {
      return;
    }
    if (stream === "stdout") {
      current.stdoutTail = `${current.stdoutTail}${chunk}`.slice(-LIVE_OUTPUT_TAIL_LIMIT);
    } else {
      current.stderrTail = `${current.stderrTail}${chunk}`.slice(-LIVE_OUTPUT_TAIL_LIMIT);
    }
    current.heartbeatAt = nowIso();
  }

  private touchLiveRunHeartbeat(runId: string): void {
    const current = this.liveRuns.get(runId);
    if (!current) {
      return;
    }
    current.heartbeatAt = nowIso();
  }

  private clearLiveRun(runId: string): void {
    this.liveRuns.delete(runId);
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
      child: null
    };
    this.running.add(task.id);
    this.runningControls.set(task.id, control);
    const startedAt = nowIso();
    const started = Date.now();
    this.initLiveRun(runId, task, trigger, startedAt);
    this.pushLiveEvent(runId, "info", "task started");
    void (async () => {
        let prepared;
        try {
          prepared = await resolveExecutionContext(task.cwd, task.prompt);
          this.pushLiveEvent(runId, "info", `resolved execution cwd: ${prepared.cwd}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.pushLiveEvent(runId, "error", message);
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
            error: message
          };
          if (options.recordRun) {
            this.pushRun(failed);
          }
          this.clearLiveRun(runId);
          this.running.delete(task.id);
          this.runningControls.delete(task.id);
          this.pumpQueue();
          for (const resolveRun of resolveRuns) {
            resolveRun(failed);
          }
          return;
        }

        const steps = task.workflowSteps && task.workflowSteps.length > 0
          ? task.workflowSteps.filter((item) => item.enabled !== false)
          : [{ name: "default", enabled: true }];
        if (steps.length === 0) {
          this.pushLiveEvent(runId, "error", "no enabled workflow steps");
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
          this.clearLiveRun(runId);
          this.running.delete(task.id);
          this.runningControls.delete(task.id);
          this.pumpQueue();
          for (const resolveRun of resolveRuns) {
            resolveRun(failed);
          }
          return;
        }
        this.setLiveRunPhase(runId, "running");
        this.setLiveRunStep(runId, 1, 0, steps.length, null);
        let mergedStdout = "";
        let mergedStderr = "";
        let finalStatus: "success" | "failed" | "timeout" | "cancelled" = "success";
        let finalExitCode: number | null = 0;
        let finalError: string | null = null;
        let firstFailure: FirstFailureInfo | null = null;
        let codexSharedSessionStarted = false;
        const codexSessionHome = task.workflowSharedSession ? codexSessionHomeForTask(task.id) : null;
        if (codexSessionHome) {
          try {
            await mkdir(codexSessionHome, { recursive: true });
          } catch (error) {
            finalStatus = "failed";
            finalExitCode = null;
            finalError = error instanceof Error ? `prepare codex session home failed: ${error.message}` : "prepare codex session home failed";
            this.pushLiveEvent(runId, "error", finalError);
            const failed: LoopRun = {
              id: runId,
              taskId: task.id,
              taskName: task.name,
              runner: task.runner,
              trigger,
              startedAt,
              endedAt: nowIso(),
              durationMs: Date.now() - started,
              status: finalStatus,
              exitCode: finalExitCode,
              stdout: "",
              stderr: "",
              error: finalError
            };
            if (options.recordRun) {
              this.pushRun(failed);
            }
            this.clearLiveRun(runId);
            this.running.delete(task.id);
            this.runningControls.delete(task.id);
            this.pumpQueue();
            for (const resolveRun of resolveRuns) {
              resolveRun(failed);
            }
            return;
          }
        }

        let round = 1;
        let stopAll = false;
        while (!stopAll) {
          const currentControl = this.runningControls.get(task.id);
          if (currentControl && currentControl.runId === runId && currentControl.cancelReason) {
            finalStatus = "cancelled";
            finalExitCode = null;
            finalError = currentControl.cancelReason;
            this.pushLiveEvent(runId, "error", finalError);
            break;
          }
          this.pushLiveEvent(runId, "info", `round ${round} started`);
          for (let i = 0; i < steps.length; i += 1) {
            const step = steps[i];
            const currentControl = this.runningControls.get(task.id);
            if (currentControl && currentControl.runId === runId && currentControl.cancelReason) {
              finalStatus = "cancelled";
              finalExitCode = null;
              finalError = currentControl.cancelReason;
              this.pushLiveEvent(runId, "error", finalError);
              stopAll = true;
              break;
            }
            this.setLiveRunStep(runId, round, i + 1, steps.length, step.name);
            this.pushLiveEvent(runId, "info", `step ${i + 1}/${steps.length} started: ${step.name}`);
            let stepContext = prepared;
            if (step.cwd != null && String(step.cwd).trim()) {
              try {
                stepContext = await resolveExecutionContext(step.cwd, prepared.prompt, prepared.cwd);
                this.pushLiveEvent(runId, "info", `step cwd resolved: ${stepContext.cwd}`);
              } catch (error) {
                finalStatus = "failed";
                finalExitCode = null;
                finalError = error instanceof Error ? error.message : String(error);
                this.pushLiveEvent(runId, "error", finalError);
                stopAll = true;
                break;
              }
            }
            const baseStepPrompt = step.name === "default"
              ? stepContext.prompt
              : buildTaskPrompt(stepContext.prompt, step.name, i, steps.length);
            const withAppend = step.promptAppend
              ? `${baseStepPrompt}\n\nStep instruction: ${step.promptAppend}`
              : baseStepPrompt;
            const stepPrompt = withAppend;
            const effectiveRunner = step.runner ? normalizeRunner(step.runner) : task.runner;
            const useManagedCodex = shouldUseManagedCodexSession(task, step, effectiveRunner);
            const cmd = useManagedCodex
              ? buildManagedCodexCommand(stepPrompt, codexSharedSessionStarted, task.workflowFullAccess)
              : buildCommand(effectiveRunner, step.command ?? task.command, stepPrompt, task.workflowFullAccess);
            if (!cmd) {
              finalStatus = "failed";
              finalExitCode = null;
              finalError = "empty command; set command for task or step";
              this.pushLiveEvent(runId, "error", finalError);
              stopAll = true;
              break;
            }
            const stepTimeout = 0;
            this.pushLiveEvent(
              runId,
              "info",
              `step ${i + 1}/${steps.length} executing (runner=${effectiveRunner}, timeout=disabled)`
            );
            const stepEnv = useManagedCodex && codexSessionHome
              ? { CODEX_HOME: codexSessionHome }
              : undefined;
            const stepResult = await this.executeCommand(
              cmd,
              stepContext.cwd,
              stepTimeout,
              stepEnv,
              (child) => {
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
              () => {
                const current = this.runningControls.get(task.id);
                if (!current || current.runId !== runId) {
                  return null;
                }
                return current.cancelReason;
              },
              (stream, chunk) => {
                this.appendLiveOutput(runId, stream, chunk);
              },
              () => {
                this.touchLiveRunHeartbeat(runId);
              }
            );
            if (useManagedCodex) {
              codexSharedSessionStarted = true;
            }
            mergedStdout += `[round ${round}] [step ${i + 1}/${steps.length}] ${step.name} (runner=${effectiveRunner}, timeout=disabled)\n${stepResult.stdout}\n`;
            mergedStderr += `[round ${round}] [step ${i + 1}/${steps.length}] ${step.name} (runner=${effectiveRunner}, timeout=disabled)\n${stepResult.stderr}\n`;
            if (stepResult.status !== "success") {
              this.pushLiveEvent(
                runId,
                "error",
                `step ${i + 1}/${steps.length} ended with ${stepResult.status} (exit=${stepResult.exitCode == null ? "-" : stepResult.exitCode})`
              );
              if (!firstFailure) {
                firstFailure = {
                  result: stepResult,
                  round,
                  stepIndex: i + 1,
                  stepCount: steps.length,
                  stepName: step.name
                };
              }
              if (step.continueOnError) {
                this.pushLiveEvent(runId, "info", `step ${i + 1}/${steps.length} continueOnError=true, move on`);
                mergedStderr += `[round ${round}] [step ${i + 1}/${steps.length}] continue on error enabled, moving to next step\n`;
                continue;
              }
              finalStatus = stepResult.status;
              finalExitCode = stepResult.exitCode;
              finalError = stepResult.error;
              stopAll = true;
              break;
            }
            this.pushLiveEvent(runId, "info", `step ${i + 1}/${steps.length} completed successfully`);
            finalExitCode = stepResult.exitCode;
          }
          if (!task.workflowLoopFromStart || stopAll) {
            break;
          }
          this.pushLiveEvent(runId, "info", `round ${round} completed, loop from start enabled`);
          round += 1;
        }

        if (!finalError && firstFailure) {
          const first = firstFailure.result;
          finalStatus = first.status;
          finalExitCode = first.exitCode;
          const explicit = first.error
            ? String(first.error).trim()
            : "";
          const stderrTail = String(first.stderr || "").trim().slice(-240);
          const location = `first failure at round ${firstFailure.round}, step ${firstFailure.stepIndex}/${firstFailure.stepCount} (${firstFailure.stepName})`;
          const statusLine = `status=${first.status}, exit=${first.exitCode == null ? "-" : first.exitCode}`;
          if (explicit) {
            finalError = `${location}: ${statusLine}; error=${explicit}`;
          } else if (stderrTail) {
            finalError = `${location}: ${statusLine}; stderr=${stderrTail}`;
          } else {
            finalError = `${location}: ${statusLine}; one or more steps failed but execution continued`;
          }
        }

        const endedAt = nowIso();
        this.setLiveRunPhase(runId, "finishing");
        this.pushLiveEvent(runId, finalStatus === "success" ? "info" : "error", `task finished with ${finalStatus}`);
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
          stdout: mergedStdout.slice(0, 20000),
          stderr: mergedStderr.slice(0, 20000),
          error: finalError
        };

        if (options.recordRun) {
          this.pushRun(run);
        }
        if (options.persistTaskState) {
          const current = this.tasks.get(task.id);
          if (current) {
            const updated: LoopTask = {
              ...current,
              lastRunAt: endedAt,
              updatedAt: nowIso()
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

        this.clearLiveRun(runId);
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
        this.clearLiveRun(runId);
        this.running.delete(task.id);
        this.runningControls.delete(task.id);
        this.pumpQueue();
        for (const resolveRun of resolveRuns) {
          resolveRun(failed);
        }
      });
  }

  private executeCommand(
    command: string,
    cwd: string,
    _timeoutSec: number,
    envPatch?: Record<string, string>,
    onSpawn?: (child: ChildProcessWithoutNullStreams) => void,
    cancellationReason?: () => string | null,
    onChunk?: StreamChunkListener,
    onHeartbeat?: HeartbeatListener
  ): Promise<CommandExecutionResult> {
    return new Promise<CommandExecutionResult>((resolveResult) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      const child = spawn("/bin/zsh", ["-lc", command], {
        cwd,
        env: {
          ...process.env,
          ...(envPatch ?? {})
        }
      });
      if (onSpawn) {
        onSpawn(child);
      }

      const heartbeatTimer = setInterval(() => {
        if (onHeartbeat) {
          onHeartbeat();
        }
      }, 5000);

      const finalize = (result: CommandExecutionResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearInterval(heartbeatTimer);
        resolveResult(result);
      };

      child.stdout.on("data", (chunk: Buffer | string) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        stdout += text;
        if (onChunk) {
          onChunk("stdout", text);
        }
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        stderr += text;
        if (onChunk) {
          onChunk("stderr", text);
        }
      });

      const finalizeWithCode = (code: number | null): void => {
        const cancelledReason = cancellationReason ? cancellationReason() : null;
        finalize({
          status: cancelledReason
            ? "cancelled"
            : (code === 0 ? "success" : "failed"),
          exitCode: code,
          stdout,
          stderr,
          error: cancelledReason || null
        });
      };

      child.on("exit", (code) => {
        finalizeWithCode(code);
      });

      child.on("close", (code) => {
        finalizeWithCode(code);
      });

      child.on("error", (error) => {
        finalize({
          status: "failed",
          exitCode: null,
          stdout,
          stderr,
          error: error.message
        });
      });
    });
  }

  private pushRun(run: LoopRun): void {
    this.runs.unshift(run);
    if (this.runs.length > 200) {
      this.runs.length = 200;
    }
  }
}
