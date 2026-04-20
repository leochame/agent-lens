import test from "node:test";
import assert from "node:assert/strict";
import { renderHomeHtml } from "./page";

test("renderHomeHtml links to router log and loop pages", () => {
  const html = renderHomeHtml();
  assert.match(html, /href="\/__router"/);
  assert.match(html, /href="\/__log"/);
  assert.match(html, /href="\/__loop"/);
  assert.match(html, /class="workbench-link active" href="\/__home"/);
  assert.match(html, /aria-label="功能侧边栏"/);
  assert.match(html, /aria-label="首页路径"/);
  assert.match(html, /AgentLens/);
  assert.match(html, /\.workbench\s*\{/);
  assert.match(html, /class="workbench-sidebar"/);
  assert.match(html, /Control Surface/);
  const compact = html.replace(/\s+/g, " ");
  assert.match(compact, /Home<\/strong>.*Router<\/h2>.*Log<\/h2>.*Loop<\/h2>/);
  assert.doesNotMatch(compact, /Navigation<\/strong>/);
  assert.doesNotMatch(compact, /<code>frontend<\/code>/);
  assert.doesNotMatch(compact, /配置已加载/);
  assert.doesNotMatch(compact, /id="logList"/);
  assert.doesNotMatch(compact, />Open</);
  assert.doesNotMatch(compact, /upstream \/ provider \/ route/);
});
