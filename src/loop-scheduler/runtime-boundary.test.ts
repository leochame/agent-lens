import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("loop scheduler depends on runtime contracts instead of core contracts", async () => {
  const enginePath = join(process.cwd(), "src", "loop-scheduler", "engine.ts");
  const content = await readFile(enginePath, "utf8");

  assert.equal(content.includes("../aiframework/core/"), false);
  assert.match(content, /\.\.\/aiframework\/runtime\/contracts/);
});
