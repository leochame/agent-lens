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
} {
  const html = renderLoopHtml();
  const scriptStart = html.indexOf("<script>");
  const scriptEnd = html.lastIndexOf("</script>");
  if (scriptStart < 0 || scriptEnd < 0 || scriptEnd <= scriptStart) {
    throw new Error("script block not found");
  }
  const script = html.slice(scriptStart + "<script>".length, scriptEnd);
  const source = extractFunctionSource(script, "friendlyError");
  const context = vm.createContext({});
  vm.runInContext(
    `${source}
this.__ui__ = { friendlyError };`,
    context
  );
  const api = (context as { __ui__: unknown }).__ui__;
  if (!api || typeof api !== "object") {
    throw new Error("ui api not initialized");
  }
  return api as {
    friendlyError: (input: unknown) => string;
  };
}

test("friendlyError maps workflow enabled-step backend errors to localized hints", () => {
  const ui = buildUiApi();
  assert.equal(
    ui.friendlyError("workflow must have at least one enabled step"),
    "Workflow 至少需要 1 个启用步骤。"
  );
  assert.equal(
    ui.friendlyError("no enabled workflow steps"),
    "Workflow 中没有启用步骤：请至少启用一个步骤。"
  );
});
