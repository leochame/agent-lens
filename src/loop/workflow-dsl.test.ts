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
  normalizeStep: (step: Record<string, unknown>) => Record<string, unknown>;
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
    extractFunctionSource(script, "parseUiBoolean"),
    extractFunctionSource(script, "hasWorkflowDefinition"),
    extractFunctionSource(script, "normalizeStep")
  ].join("\n");
  const context = vm.createContext({});
  vm.runInContext(
    `${source}
this.__ui__ = { hasWorkflowDefinition, normalizeStep };`,
    context
  );
  const api = (context as { __ui__: unknown }).__ui__;
  if (!api || typeof api !== "object") {
    throw new Error("ui api not initialized");
  }
  return api as {
    hasWorkflowDefinition: (taskLike: Record<string, unknown>) => boolean;
    normalizeStep: (step: Record<string, unknown>) => Record<string, unknown>;
  };
}

function buildCollectFormBody(mode: "command" | "workflow"): {
  collectFormBody: (syncWorkflow?: boolean) => Record<string, unknown>;
  setWorkflowCarryContext: (value: string) => void;
} {
  const html = renderLoopHtml();
  const scriptStart = html.indexOf("<script>");
  const scriptEnd = html.lastIndexOf("</script>");
  if (scriptStart < 0 || scriptEnd < 0 || scriptEnd <= scriptStart) {
    throw new Error("script block not found");
  }
  const script = html.slice(scriptStart + "<script>".length, scriptEnd);
  const collectFormBodySource = extractFunctionSource(script, "collectFormBody");
  const elements: Record<string, { value: string }> = {
    name: { value: "task-a" },
    runner: { value: "custom" },
    prompt: { value: "hello" },
    intervalSec: { value: "300" }
  };
  const context = vm.createContext({
    advancedModeEl: { value: mode },
    commandInputEl: { value: "echo ok" },
    cwdInputEl: { value: "" },
    workflowLoopFromStartEl: { value: "false" },
    workflowSharedSessionEl: { value: "true" },
    workflowFullAccessEl: { value: "false" },
    modeDraft: { workflowCarryContext: "false" },
    workflowBuilderRows: [],
    ensureWorkflowUiLoaded: () => {},
    syncTextareaFromBuilder: () => {},
    normalizeStep: (step: Record<string, unknown>) => step,
    parseToolInputText: (value: unknown) => value,
    parseUiBoolean: (value: unknown, fallback: boolean) => {
      if (value === undefined || value === null) return fallback;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      const text = String(value).trim().toLowerCase();
      if (!text) return fallback;
      if (text === "true" || text === "1" || text === "yes" || text === "on") return true;
      if (text === "false" || text === "0" || text === "no" || text === "off") return false;
      return fallback;
    },
    editingTaskId: null,
    editingTaskEnabled: true,
    document: {
      getElementById: (id: string) => elements[id]
    }
  });
  vm.runInContext(
    `${collectFormBodySource}
this.__collectFormBody__ = collectFormBody;`,
    context
  );
  const collect = (context as { __collectFormBody__: unknown }).__collectFormBody__;
  if (typeof collect !== "function") {
    throw new Error("collectFormBody not initialized");
  }
  return {
    collectFormBody: collect as (syncWorkflow?: boolean) => Record<string, unknown>,
    setWorkflowCarryContext: (value: string) => {
      (context as { modeDraft: { workflowCarryContext: string } }).modeDraft.workflowCarryContext = value;
    }
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

test("workflow normalizeStep maps tool step to UI editable fields", () => {
  const ui = buildUiApi();
  const normalized = ui.normalizeStep({
    name: "tool-step",
    tool: { name: "search", input: { q: "a" } },
    enabled: true
  });
  assert.equal(normalized.stepType, "tool");
  assert.equal(normalized.toolName, "search");
  assert.equal(normalized.toolInput, "{\"q\":\"a\"}");
});

test("workflow normalizeStep preserves multiline promptAppend for textarea editing", () => {
  const ui = buildUiApi();
  const normalized = ui.normalizeStep({
    name: "draft-step",
    promptAppend: "line 1\nline 2\n\nline 4"
  });
  assert.equal(normalized.promptAppend, "line 1\nline 2\n\nline 4");
});

test("collectFormBody resets workflow payload in command mode", () => {
  const { collectFormBody } = buildCollectFormBody("command");
  const body = collectFormBody(false);
  assert.equal(body.workflow, "");
  assert.equal(Array.isArray(body.workflowSteps), true);
  assert.equal((body.workflowSteps as unknown[]).length, 0);
  assert.equal(body.workflowCarryContext, false);
  assert.equal(body.workflowLoopFromStart, false);
  assert.equal(body.workflowSharedSession, true);
  assert.equal(body.workflowFullAccess, false);
});

test("collectFormBody keeps workflowCarryContext from draft state", () => {
  const { collectFormBody, setWorkflowCarryContext } = buildCollectFormBody("workflow");
  const body1 = collectFormBody(false);
  assert.equal(body1.workflowCarryContext, false);
  setWorkflowCarryContext("true");
  const body2 = collectFormBody(false);
  assert.equal(body2.workflowCarryContext, true);
});
