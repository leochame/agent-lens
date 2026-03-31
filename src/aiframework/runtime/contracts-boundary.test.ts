import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("runtime contracts keep runtime naming and compatibility aliases", async () => {
  const content = await readFile(join(process.cwd(), "src", "aiframework", "runtime", "contracts.ts"), "utf8");
  assert.doesNotMatch(content, /from "\.\.\/core\//);
  assert.match(content, /export type RuntimeWorkflowRunner = "claude_code" \| "codex" \| "custom" \| "openai" \| "anthropic";/);
  assert.match(content, /export type RuntimeModelProvider = "openai" \| "anthropic";/);
  assert.match(content, /export type RuntimeToolCall = \{/);
  assert.match(content, /export type RuntimeCommandExecutionResult = \{/);
  assert.match(content, /export type RuntimeWorkflowExecutionResult = \{/);
  assert.match(content, /export type RuntimeWorkflowStepInput = \{/);
  assert.match(content, /export type RuntimeTaskRuntimeExecutionRequest = \{/);
  assert.match(content, /export type RuntimeAgentRuntimeExecutionOverrides = \{/);
  assert.doesNotMatch(content, /from "\.\/task-runtime"/);
  assert.doesNotMatch(content, /from "\.\/agent-runtime"/);
  assert.match(content, /Deprecation window: 2026-03-31 to 2026-09-30/);
  assert.match(content, /@deprecated Use RuntimeWorkflowRunner\. Removal target: v2\.0\.0 after 2026-09-30\./);
  assert.match(content, /export type WorkflowRunner = RuntimeWorkflowRunner;/);
  assert.match(content, /export type WorkflowStepInput = RuntimeWorkflowStepInput;/);
});
