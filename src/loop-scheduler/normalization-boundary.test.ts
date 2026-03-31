import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("scheduler normalization module reuses runtime workflow normalization as single source", async () => {
  const content = await readFile(join(process.cwd(), "src", "loop-scheduler", "task-normalization.ts"), "utf8");
  assert.match(content, /\.\.\/aiframework\/runtime\/workflow-normalization/);
  assert.doesNotMatch(content, /function normalizeRunner\(/);
  assert.doesNotMatch(content, /function normalizeStepRetryCount\(/);
  assert.doesNotMatch(content, /function normalizeStepRetryBackoffMs\(/);
});
