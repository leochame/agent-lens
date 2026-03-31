import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("runtime contracts do not expose legacy timeout fields on task/step DTO", async () => {
  const content = await readFile(join(process.cwd(), "src", "aiframework", "runtime", "contracts.ts"), "utf8");
  const stepBlock = content.match(/export type RuntimeWorkflowStepInput = \{[\s\S]*?\n\};\n\nexport type RuntimeWorkflowTaskInput = \{/);
  assert.ok(stepBlock);
  assert.doesNotMatch(stepBlock[0], /timeoutSec:/);

  const taskBlock = content.match(/export type RuntimeWorkflowTaskInput = \{[\s\S]*?\n\};\n\nexport type RuntimeWorkflowExecutionCallbacks = \{/);
  assert.ok(taskBlock);
  assert.doesNotMatch(taskBlock[0], /timeoutSec:/);
});

test("legacy timeout remains scheduler-input compatibility only", async () => {
  const normalization = await readFile(join(process.cwd(), "src", "loop-scheduler", "task-normalization.ts"), "utf8");
  const store = await readFile(join(process.cwd(), "src", "loop-scheduler", "store.ts"), "utf8");
  assert.match(normalization, /Legacy no-op: timeoutSec is accepted for backward compatibility/);
  assert.doesNotMatch(normalization, /next\.timeoutSec\s*=/);
  assert.match(store, /const \{ timeoutSec: _timeoutSec, \.\.\.rest \} = task;/);
});
