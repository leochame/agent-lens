import test from "node:test";
import assert from "node:assert/strict";
import {
  STEP_RETRY_BACKOFF_DEFAULT_MS,
  normalizeStepRetryBackoffMs,
  normalizeStepRetryCount,
  normalizeWorkflowRunner
} from "./workflow-normalization";

test("normalizeWorkflowRunner falls back to custom for unsupported values", () => {
  assert.equal(normalizeWorkflowRunner("codex"), "codex");
  assert.equal(normalizeWorkflowRunner("openai"), "openai");
  assert.equal(normalizeWorkflowRunner("unsupported"), "custom");
  assert.equal(normalizeWorkflowRunner(null), "custom");
});

test("normalizeStepRetryCount clamps and floors to integer", () => {
  assert.equal(normalizeStepRetryCount(undefined), 0);
  assert.equal(normalizeStepRetryCount(-1), 0);
  assert.equal(normalizeStepRetryCount(1.9), 1);
  assert.equal(normalizeStepRetryCount(99), 8);
});

test("normalizeStepRetryBackoffMs uses bounded range and default", () => {
  assert.equal(normalizeStepRetryBackoffMs(undefined), STEP_RETRY_BACKOFF_DEFAULT_MS);
  assert.equal(normalizeStepRetryBackoffMs(1), 200);
  assert.equal(normalizeStepRetryBackoffMs(1800), 1800);
  assert.equal(normalizeStepRetryBackoffMs(999999), 30000);
});
