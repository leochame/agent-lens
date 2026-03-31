import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("loop-scheduler types reuse runtime contracts for runner and step", async () => {
  const content = await readFile(join(process.cwd(), "src", "loop-scheduler", "types.ts"), "utf8");
  assert.match(content, /from "\.\.\/aiframework\/runtime\/contracts"/);
  assert.match(content, /import type \{ RuntimeWorkflowRunner, RuntimeWorkflowStepInput \} from "\.\.\/aiframework\/runtime\/contracts";/);
  assert.match(content, /export type LoopRunner = RuntimeWorkflowRunner;/);
  assert.match(content, /export type WorkflowStep = RuntimeWorkflowStepInput;/);
  assert.match(content, /export type WorkflowStepInputCompat = RuntimeWorkflowStepInput & \{/);
  assert.equal(content.includes('export type LoopRunner = "claude_code"'), false);
});
