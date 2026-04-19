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
  taskRuntimeUi: (
    task: { enabled?: boolean; workflowLoopFromStart?: boolean },
    runtimeState: string | { isRunning?: boolean; isQueued?: boolean }
  ) => {
    toggleLabel: string;
    runtimeHint: string;
    runLabel: string;
    stopLabel: string;
    runtimeTag: string;
  };
  toggleResultMessage: (
    taskEnabledBefore: boolean,
    runtimeState: string | { isRunning?: boolean; isQueued?: boolean }
  ) => string;
} {
  const html = renderLoopHtml();
  const scriptStart = html.indexOf("<script>");
  const scriptEnd = html.lastIndexOf("</script>");
  if (scriptStart < 0 || scriptEnd < 0 || scriptEnd <= scriptStart) {
    throw new Error("script block not found");
  }
  const script = html.slice(scriptStart + "<script>".length, scriptEnd);
  const source = [
    extractFunctionSource(script, "normalizeTaskRuntimeState"),
    extractFunctionSource(script, "taskRuntimeUi"),
    extractFunctionSource(script, "toggleResultMessage")
  ].join("\n");
  const context = vm.createContext({});
  vm.runInContext(
    `${source}
this.__ui__ = { taskRuntimeUi, toggleResultMessage };`,
    context
  );
  const api = (context as { __ui__: unknown }).__ui__;
  if (!api || typeof api !== "object") {
    throw new Error("ui api not initialized");
  }
  return api as {
    taskRuntimeUi: (
      task: { enabled?: boolean; workflowLoopFromStart?: boolean },
      runtimeState: string | { isRunning?: boolean; isQueued?: boolean }
    ) => {
      toggleLabel: string;
      runtimeHint: string;
      runLabel: string;
      stopLabel: string;
      runtimeTag: string;
    };
    toggleResultMessage: (
      taskEnabledBefore: boolean,
      runtimeState: string | { isRunning?: boolean; isQueued?: boolean }
    ) => string;
  };
}

test("taskRuntimeUi keeps running+disabled state and actions consistent", () => {
  const ui = buildUiApi();
  const state = ui.taskRuntimeUi({ enabled: false, workflowLoopFromStart: true }, "running");
  assert.equal(state.toggleLabel, "♻ 重新启用调度");
  assert.equal(state.runLabel, "↻ 重启执行");
  assert.match(state.runtimeHint, /当前轮次会继续/);
});

test("taskRuntimeUi marks queued+disabled with explicit scheduling hint", () => {
  const ui = buildUiApi();
  const state = ui.taskRuntimeUi({ enabled: false }, "queued");
  assert.equal(state.toggleLabel, "♻ 重新启用调度");
  assert.match(state.runtimeHint, /本次请求仍在队列/);
});

test("taskRuntimeUi keeps idle+disabled toggle clear", () => {
  const ui = buildUiApi();
  const state = ui.taskRuntimeUi({ enabled: false }, "idle");
  assert.equal(state.toggleLabel, "✅ 启用");
  assert.equal(state.runLabel, "▶ 手动执行");
});

test("toggleResultMessage explains re-enable behavior by runtime state", () => {
  const ui = buildUiApi();
  assert.equal(ui.toggleResultMessage(true, "running"), "任务已停止并停用");
  assert.equal(ui.toggleResultMessage(false, "running"), "任务已重新启用：当前轮次继续，后续将恢复自动调度");
  assert.equal(ui.toggleResultMessage(false, "queued"), "任务已重新启用：当前请求仍在队列，后续将恢复自动调度");
  assert.equal(ui.toggleResultMessage(false, "idle"), "任务已启用");
});

test("taskRuntimeUi surfaces queued restart while current run is still active", () => {
  const ui = buildUiApi();
  const state = ui.taskRuntimeUi({ enabled: true, workflowLoopFromStart: true }, { isRunning: true, isQueued: true });
  assert.equal(state.runLabel, "↻ 保留最新重启");
  assert.equal(state.stopLabel, "停止并清空排队");
  assert.match(state.runtimeHint, /已收到最新一次重启请求/);
  assert.match(state.runtimeTag, /已排重启/);
});

test("toggleResultMessage explains re-enable behavior when run and queued restart coexist", () => {
  const ui = buildUiApi();
  assert.equal(
    ui.toggleResultMessage(false, { isRunning: true, isQueued: true }),
    "任务已重新启用：当前轮次继续，已排队的下一轮会保留，后续也将恢复自动调度"
  );
});
