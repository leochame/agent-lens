import type { RuntimeWorkflowRunner } from "./contracts";

const STEP_RETRY_COUNT_MIN = 0;
const STEP_RETRY_COUNT_MAX = 8;
const STEP_RETRY_BACKOFF_MS_MIN = 200;
const STEP_RETRY_BACKOFF_MS_MAX = 30000;
export const STEP_RETRY_BACKOFF_DEFAULT_MS = 1200;

function parseBoundedNumber(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return Math.max(min, Math.min(max, n));
}

export function normalizeWorkflowRunner(value: unknown): RuntimeWorkflowRunner {
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
