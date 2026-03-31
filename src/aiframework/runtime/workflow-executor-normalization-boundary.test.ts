import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("workflow executor uses shared normalization module", async () => {
  const content = await readFile(join(process.cwd(), "src", "aiframework", "runtime", "workflow-executor.ts"), "utf8");
  assert.match(content, /from "\.\/workflow-normalization"/);
  assert.doesNotMatch(content, /function normalizeRunner\(/);
  assert.doesNotMatch(content, /function normalizeStepRetryCount\(/);
  assert.doesNotMatch(content, /function normalizeStepRetryBackoffMs\(/);
});
