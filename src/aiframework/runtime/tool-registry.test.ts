import test from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./tool-registry";

test("tool registry register and find tool", () => {
  const registry = new ToolRegistry();
  registry.register({
    name: "echo",
    execute: (call) => ({
      success: true,
      output: String(call.input ?? "")
    })
  });

  const found = registry.find("echo");
  assert.ok(found);
  assert.equal(found?.name, "echo");
});

test("tool registry execute handles success, not found and throw", async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: "ok-tool",
    execute: () => ({
      success: true,
      output: "done"
    })
  });
  registry.register({
    name: "boom-tool",
    execute: () => {
      throw new Error("boom");
    }
  });

  const ok = await registry.execute({ name: "ok-tool", cwd: process.cwd() });
  assert.equal(ok.success, true);
  assert.equal(ok.output, "done");

  const notFound = await registry.execute({ name: "missing", cwd: process.cwd() });
  assert.equal(notFound.success, false);
  assert.match(String(notFound.error), /tool not found/);

  const failed = await registry.execute({ name: "boom-tool", cwd: process.cwd() });
  assert.equal(failed.success, false);
  assert.match(String(failed.error), /boom/);
});

test("tool registry rejects empty names", async () => {
  const registry = new ToolRegistry();
  assert.throws(
    () => registry.register({ name: " ", execute: () => ({ success: true, output: "" }) }),
    /tool name is required/
  );

  const badCall = await registry.execute({ name: " ", cwd: process.cwd() });
  assert.equal(badCall.success, false);
  assert.match(String(badCall.error), /tool name is required/);
});
