import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { renderLoopHtml } from "./html";

function extractFunctionSource(script: string, fnName: string): string {
  const start = script.indexOf(`function ${fnName}(`);
  if (start < 0) {
    throw new Error(`function not found: ${fnName}`);
  }
  const open = script.indexOf("{", start);
  if (open < 0) {
    throw new Error(`function body not found: ${fnName}`);
  }
  let depth = 0;
  for (let i = open; i < script.length; i += 1) {
    const ch = script[i];
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return script.slice(start, i + 1);
      }
    }
  }
  throw new Error(`function parse failed: ${fnName}`);
}

function buildUiApi(): {
  friendlyError: (input: unknown) => string;
  diagnoseRun: (run: { error?: unknown; stderr?: unknown; stdout?: unknown }) => string;
} {
  const html = renderLoopHtml();
  const scriptStart = html.indexOf("<script>");
  const scriptEnd = html.lastIndexOf("</script>");
  if (scriptStart < 0 || scriptEnd < 0 || scriptEnd <= scriptStart) {
    throw new Error("script block not found");
  }
  const script = html.slice(scriptStart + "<script>".length, scriptEnd);
  const source = [
    extractFunctionSource(script, "replaceText"),
    extractFunctionSource(script, "normalizeNewlines"),
    extractFunctionSource(script, "splitLines"),
    extractFunctionSource(script, "friendlyError"),
    extractFunctionSource(script, "diagnoseRun")
  ].join("\n");
  const context = vm.createContext({});
  vm.runInContext(
    `${source}
this.__ui__ = { friendlyError, diagnoseRun };`,
    context
  );
  const api = (context as { __ui__: unknown }).__ui__;
  if (!api || typeof api !== "object") {
    throw new Error("ui api not initialized");
  }
  return api as {
    friendlyError: (input: unknown) => string;
    diagnoseRun: (run: { error?: unknown; stderr?: unknown; stdout?: unknown }) => string;
  };
}

test("friendlyError maps workflow enabled-step backend errors to localized hints", () => {
  const ui = buildUiApi();
  assert.equal(
    ui.friendlyError("workflow must have at least one enabled step"),
    "Workflow 至少需要 1 个启用步骤。"
  );
  assert.equal(
    ui.friendlyError("workflow requires at least one step"),
    "Workflow 至少需要 1 个步骤。"
  );
  assert.equal(
    ui.friendlyError("no enabled workflow steps"),
    "Workflow 中没有启用步骤：请至少启用一个步骤。"
  );
});

test("friendlyError only maps missing-path errors when path/cwd context exists", () => {
  const ui = buildUiApi();
  assert.equal(
    ui.friendlyError("workflow step \"a\" cwd invalid: no such file or directory"),
    "路径不存在：请检查工作目录/文件路径是否正确。"
  );
  assert.equal(
    ui.friendlyError("rg: main: No such file or directory (os error 2)"),
    "rg: main: No such file or directory (os error 2)"
  );
});

test("diagnoseRun does not mislabel command stderr as cwd-path issue", () => {
  const ui = buildUiApi();
  const diagnosis = ui.diagnoseRun({
    error: "one or more steps failed but execution continued",
    stderr: "rg: main: No such file or directory (os error 2)",
    stdout: ""
  });
  assert.equal(diagnosis, "");
});

test("diagnoseRun does not mislabel when workdir appears on a different line", () => {
  const ui = buildUiApi();
  const diagnosis = ui.diagnoseRun({
    error: "one or more steps failed but execution continued",
    stderr: "rg: main: No such file or directory (os error 2)",
    stdout: "workdir: /Users/leocham/Documents/code/dev_02/OpenManus-Java"
  });
  assert.equal(diagnosis, "");
});
