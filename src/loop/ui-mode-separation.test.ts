import test from "node:test";
import assert from "node:assert/strict";
import { renderLoopHtml } from "./html";

function extractScript(html: string): string {
  const scriptStart = html.indexOf("<script>");
  const scriptEnd = html.lastIndexOf("</script>");
  assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, "script block should exist");
  return html.slice(scriptStart + "<script>".length, scriptEnd);
}

test("loop page exposes command/workflow modes and workflow loop strategy", () => {
  const html = renderLoopHtml();
  const script = extractScript(html);

  assert.match(html, /<option value="workflow" selected>多步骤 Workflow 模式（推荐）<\/option>/);
  assert.match(html, /<option value="command">单命令兼容模式<\/option>/);
  assert.match(script, /id="workflowLoopFromStart"/);
  assert.match(script, /id="workflowNewSessionPerStep"/);
  assert.match(script, /id="workflowNewSessionPerRound"/);
  assert.match(script, /id="workflowFullAccess"/);
  assert.match(script, /<option value="true">从头循环<\/option>/);
});

test("mode panel mounts workflow and command sections separately", () => {
  const script = extractScript(renderLoopHtml());

  assert.match(script, /if \(mode === "workflow"\)/);
  assert.match(script, /id="workflowBuilderField"/);
  assert.match(script, /data-k="stepType"/);
  assert.match(script, /data-k="toolName"/);
  assert.match(script, /data-k="toolInput"/);
  assert.match(script, /workflowCarryContextEl = null;/);
  assert.match(script, /workflowLoopFromStartEl = null;/);
});

test("runner selector exposes model and cli runners and form uses selected runner", () => {
  const html = renderLoopHtml();
  const script = extractScript(html);

  assert.match(html, /<option value="custom" selected>custom<\/option>/);
  assert.match(html, /<option value="codex">codex<\/option>/);
  assert.match(html, /<option value="claude_code">claude_code<\/option>/);
  assert.match(html, /<option value="openai">openai<\/option>/);
  assert.match(html, /<option value="anthropic">anthropic<\/option>/);
  assert.match(script, /runner: String\(document\.getElementById\("runner"\)\.value \|\| "custom"\)/);
});

test("loop page inline script remains syntactically valid", () => {
  const script = extractScript(renderLoopHtml());
  assert.doesNotThrow(() => new Function(script));
});

test("loop page inline script avoids replaceAll for browser compatibility", () => {
  const script = extractScript(renderLoopHtml());
  assert.doesNotMatch(script, /\.replaceAll\(/);
});

test("loop page inline script avoids fragile modern shorthand in critical paths", () => {
  const script = extractScript(renderLoopHtml());
  assert.doesNotMatch(script, /catch\s*\{/);
  assert.doesNotMatch(script, /\{\s*\.\.\.item/);
  assert.doesNotMatch(script, /target\.closest\(/);
});

test("loop page inline script avoids regex literals in hot paths", () => {
  const script = extractScript(renderLoopHtml());
  assert.doesNotMatch(script, /split\(\/|replace\(\/|\/\\bstat\\b\//);
});

test("task action area groups primary config and danger buttons in order", () => {
  const html = renderLoopHtml();
  assert.match(html, /action-group-label">主操作<\/div><div class="action-group-buttons">/);
  assert.match(html, /action-group-label">配置<\/div><div class="action-group-buttons">/);
  assert.match(html, /action-group-label">风险操作<\/div><div class="action-group-buttons">/);
  const primaryIdx = html.indexOf('action-group-label">主操作<');
  const configIdx = html.indexOf('action-group-label">配置<');
  const dangerIdx = html.indexOf('action-group-label">风险操作<');
  assert.ok(primaryIdx >= 0 && configIdx > primaryIdx && dangerIdx > configIdx);
});

test("task library includes detail overlay and card interaction hooks", () => {
  const html = renderLoopHtml();
  const script = extractScript(html);

  assert.match(html, /id="taskDetailOverlay"/);
  assert.match(html, /id="taskDetailBody"/);
  assert.match(script, /data-task-card="true"/);
  assert.match(script, /function openTaskDetail\(taskId\)/);
  assert.match(script, /function closeTaskDetail\(\)/);
});
