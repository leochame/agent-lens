import {
  CreateLoopTaskInput,
  LoopTask,
  LoopRunner,
  UpdateLoopTaskInput,
  WorkflowStep
} from "./types";

const STEP_RETRY_COUNT_MIN = 0;
const STEP_RETRY_COUNT_MAX = 8;
const STEP_RETRY_BACKOFF_MS_MIN = 200;
const STEP_RETRY_BACKOFF_MS_MAX = 30000;
export const STEP_RETRY_BACKOFF_DEFAULT_MS = 1200;

export function nowIso(): string {
  return new Date().toISOString();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function parseBoundedNumber(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return clamp(n, min, max);
}

export function normalizeWorkflowRunner(value: unknown): LoopRunner {
  if (
    value === "claude_code"
    || value === "codex"
    || value === "custom"
    || value === "openai"
    || value === "anthropic"
  ) {
    return value;
  }
  return "custom";
}

export function normalizeStepRetryCount(value: unknown): number {
  const bounded = parseBoundedNumber(value, STEP_RETRY_COUNT_MIN, STEP_RETRY_COUNT_MAX);
  if (bounded == null) {
    return 0;
  }
  return Math.floor(bounded);
}

export function normalizeStepRetryBackoffMs(value: unknown): number {
  return parseBoundedNumber(value, STEP_RETRY_BACKOFF_MS_MIN, STEP_RETRY_BACKOFF_MS_MAX)
    ?? STEP_RETRY_BACKOFF_DEFAULT_MS;
}

export function normalizeOptionalPositiveInt(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  const rounded = Math.floor(num);
  return rounded >= 1 ? rounded : null;
}

export function normalizeIsoOrFallback(value: unknown, fallback: string): string {
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

export function normalizeOptionalIso(value: unknown): string | null {
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

export function parseOptionalBoolean(value: unknown): boolean | undefined {
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

export function ensureValidNumericPatch(
  raw: CreateLoopTaskInput | UpdateLoopTaskInput,
  normalized: UpdateLoopTaskInput
): void {
  if (raw.intervalSec !== undefined && normalized.intervalSec === undefined) {
    throw new Error("intervalSec must be a number between 5 and 86400");
  }
}

export function normalizeTaskInput(raw: CreateLoopTaskInput | UpdateLoopTaskInput): UpdateLoopTaskInput {
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
    const value = parseOptionalBoolean(raw.workflowCarryContext);
    if (value !== undefined) {
      next.workflowCarryContext = value;
    }
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
    next.runner = normalizeWorkflowRunner(raw.runner);
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

export function ensureWorkflowList(value: string[] | string | undefined): string[] {
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

export function ensureWorkflowSteps(
  stepsValue: WorkflowStep[] | string | undefined,
  workflowFallback: string[]
): WorkflowStep[] {
  if (Array.isArray(stepsValue)) {
    return stepsValue
      .map((step) => {
        const stepName = String(step && step.name ? step.name : "").trim();
        const continueOnError = parseOptionalBoolean(step && step.continueOnError);
        const enabled = parseOptionalBoolean(step && step.enabled);
        const toolName = step && step.tool && step.tool.name != null
          ? String(step.tool.name).trim()
          : "";
        if (step && step.tool && !toolName) {
          throw new Error(`workflow step "${stepName || "(unnamed)"}" tool name is required`);
        }
        return {
          name: stepName,
          runner: step && step.runner ? normalizeWorkflowRunner(step.runner) : undefined,
          cwd: step && step.cwd != null ? String(step.cwd).trim() || null : undefined,
          command: step && step.command != null ? String(step.command).trim() || null : undefined,
          tool: toolName
            ? {
              name: toolName,
              input: step && step.tool ? step.tool.input : undefined
            }
            : undefined,
          promptAppend: step && step.promptAppend ? String(step.promptAppend).trim() : undefined,
          retryCount: normalizeStepRetryCount(step && step.retryCount),
          retryBackoffMs: normalizeStepRetryBackoffMs(step && step.retryBackoffMs),
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
      .map((name) => ({
        name,
        enabled: true,
        continueOnError: false,
        retryCount: 0,
        retryBackoffMs: STEP_RETRY_BACKOFF_DEFAULT_MS
      }));
  }
  return workflowFallback.map((name) => ({
    name,
    enabled: true,
    continueOnError: false,
    retryCount: 0,
    retryBackoffMs: STEP_RETRY_BACKOFF_DEFAULT_MS
  }));
}

export function ensureWorkflowHasEnabledSteps(workflowSteps: WorkflowStep[]): void {
  if (workflowSteps.length === 0) {
    throw new Error("workflow requires at least one step");
  }
  if (workflowSteps.length > 0 && workflowSteps.every((step) => step.enabled === false)) {
    throw new Error("workflow must have at least one enabled step");
  }
}

function normalizeWorkflowForDiff(workflow: string[]): string[] {
  return workflow.map((item) => String(item || "").trim());
}

function normalizeWorkflowStepForDiff(step: WorkflowStep): {
  name: string;
  runner: string | null;
  cwd: string | null;
  command: string | null;
  toolName: string | null;
  toolInput: string | null;
  promptAppend: string | null;
  retryCount: number;
  retryBackoffMs: number;
  continueOnError: boolean;
  enabled: boolean;
} {
  const toolName = step && step.tool && step.tool.name != null
    ? String(step.tool.name).trim()
    : "";
  return {
    name: String(step && step.name ? step.name : "").trim(),
    runner: step && step.runner ? String(step.runner) : null,
    cwd: step && step.cwd != null ? String(step.cwd).trim() || null : null,
    command: step && step.command != null ? String(step.command).trim() || null : null,
    toolName: toolName || null,
    toolInput: toolName
      ? (() => {
        try {
          return JSON.stringify(step && step.tool ? step.tool.input : null);
        } catch {
          return String(step && step.tool ? step.tool.input : "");
        }
      })()
      : null,
    promptAppend: step && step.promptAppend ? String(step.promptAppend).trim() || null : null,
    retryCount: normalizeStepRetryCount(step && step.retryCount),
    retryBackoffMs: normalizeStepRetryBackoffMs(step && step.retryBackoffMs),
    continueOnError: parseOptionalBoolean(step && step.continueOnError) ?? false,
    enabled: parseOptionalBoolean(step && step.enabled) ?? true
  };
}

export function isWorkflowDefinitionEqual(
  leftWorkflow: string[],
  leftSteps: WorkflowStep[],
  rightWorkflow: string[],
  rightSteps: WorkflowStep[]
): boolean {
  const left = {
    workflow: normalizeWorkflowForDiff(leftWorkflow),
    workflowSteps: leftSteps.map(normalizeWorkflowStepForDiff)
  };
  const right = {
    workflow: normalizeWorkflowForDiff(rightWorkflow),
    workflowSteps: rightSteps.map(normalizeWorkflowStepForDiff)
  };
  return JSON.stringify(left) === JSON.stringify(right);
}

export function hasNoEnabledWorkflowSteps(task: LoopTask): boolean {
  return Array.isArray(task.workflowSteps)
    && task.workflowSteps.length > 0
    && task.workflowSteps.every((step) => step.enabled === false);
}

export function normalizeLoadedTask(raw: LoopTask): LoopTask {
  const now = nowIso();
  const workflow = ensureWorkflowList((raw as Partial<LoopTask>).workflow as string[] | string | undefined);
  const workflowSteps = ensureWorkflowSteps((raw as Partial<LoopTask>).workflowSteps, workflow);
  const workflowLoopFromStart = parseOptionalBoolean((raw as Partial<LoopTask>).workflowLoopFromStart);
  const workflowCarryContext = parseOptionalBoolean((raw as Partial<LoopTask>).workflowCarryContext);
  const workflowSharedSession = parseOptionalBoolean((raw as Partial<LoopTask>).workflowSharedSession);
  const workflowFullAccess = parseOptionalBoolean((raw as Partial<LoopTask>).workflowFullAccess);
  const workflowResumeStepIndex = normalizeOptionalPositiveInt((raw as Partial<LoopTask>).workflowResumeStepIndex);
  const workflowResumeUpdatedAt = normalizeOptionalIso((raw as Partial<LoopTask>).workflowResumeUpdatedAt);
  const workflowResumeReasonRaw = (raw as Partial<LoopTask>).workflowResumeReason;
  const workflowResumeReason = workflowResumeReasonRaw == null ? null : String(workflowResumeReasonRaw).trim() || null;
  const intervalSec = parseBoundedNumber((raw as Partial<LoopTask>).intervalSec, 5, 86400) ?? 300;
  const timeoutSec = 0;
  const enabled = parseOptionalBoolean((raw as Partial<LoopTask>).enabled) ?? true;
  const runner = normalizeWorkflowRunner((raw as Partial<LoopTask>).runner);
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
    workflowCarryContext: workflowCarryContext ?? false,
    workflowLoopFromStart: workflowLoopFromStart ?? false,
    workflowSharedSession: workflowSharedSession ?? true,
    workflowFullAccess: workflowFullAccess ?? false,
    workflowResumeStepIndex,
    workflowResumeUpdatedAt,
    workflowResumeReason
  };
}
