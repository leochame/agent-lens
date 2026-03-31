import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const runtimeRoot = join(process.cwd(), "src", "aiframework", "runtime");

const cases = [
  "agent-runtime.ts",
  "task-runtime.ts",
  "tool-registry.ts",
  "workflow-executor.ts"
];

for (const file of cases) {
  test(`runtime file ${file} does not import core type modules`, async () => {
    const content = await readFile(join(runtimeRoot, file), "utf8");
    assert.doesNotMatch(content, /from "\.\.\/core\/workflow"/);
    assert.doesNotMatch(content, /from "\.\.\/core\/tool"/);
    assert.doesNotMatch(content, /from "\.\.\/core\/model"/);
    assert.doesNotMatch(content, /from "\.\.\/core\/memory"/);
  });
}
