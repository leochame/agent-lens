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
  hasWorkflowDefinition: (taskLike: Record<string, unknown>) => boolean;
} {
  const html = renderLoopHtml();
  const scriptStart = html.indexOf("<script>");
  const scriptEnd = html.lastIndexOf("</script>");
  if (scriptStart < 0 || scriptEnd < 0 || scriptEnd <= scriptStart) {
    throw new Error("script block not found");
  }
  const script = html.slice(scriptStart + "<script>".length, scriptEnd);
  const source = extractFunctionSource(script, "hasWorkflowDefinition");
  const context = vm.createContext({});
  vm.runInContext(
    `${source}
this.__ui__ = { hasWorkflowDefinition };`,
    context
  );
  const api = (context as { __ui__: unknown }).__ui__;
  if (!api || typeof api !== "object") {
    throw new Error("ui api not initialized");
  }
  return api as {
    hasWorkflowDefinition: (taskLike: Record<string, unknown>) => boolean;
  };
}

test("workflow detection prefers visual step definitions", () => {
  const ui = buildUiApi();
  assert.equal(
    ui.hasWorkflowDefinition({
      workflowSteps: [{ name: "开发" }]
    }),
    true
  );
  assert.equal(
    ui.hasWorkflowDefinition({
      workflowSteps: []
    }),
    false
  );
});

test("workflow detection keeps legacy array compatibility but ignores DSL string", () => {
  const ui = buildUiApi();
  assert.equal(
    ui.hasWorkflowDefinition({
      workflow: ["开发", "Code Review"],
      workflowSteps: []
    }),
    true
  );
  assert.equal(
    ui.hasWorkflowDefinition({
      workflow: "开发|custom|cmd",
      workflowSteps: []
    }),
    false
  );
});
