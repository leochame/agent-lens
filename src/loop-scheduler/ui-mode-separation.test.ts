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

  assert.match(html, /<option value="command" selected>自定义命令模式（推荐）<\/option>/);
  assert.match(html, /<option value="workflow">多步骤 Workflow 模式<\/option>/);
  assert.match(script, /id="workflowLoopFromStart"/);
  assert.match(script, /id="workflowSharedSession"/);
  assert.match(script, /id="workflowFullAccess"/);
  assert.match(script, /从头循环（直到失败或总超时）/);
});

test("mode panel mounts workflow and command sections separately", () => {
  const script = extractScript(renderLoopHtml());

  assert.match(script, /if \(mode === "workflow"\)/);
  assert.match(script, /id="workflowBuilderField"/);
  assert.match(script, /workflowCarryContextEl = null;/);
  assert.match(script, /workflowLoopFromStartEl = null;/);
});

test("loop page inline script remains syntactically valid", () => {
  const script = extractScript(renderLoopHtml());
  assert.doesNotThrow(() => new Function(script));
});
