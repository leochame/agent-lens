import test from "node:test";
import assert from "node:assert/strict";
import { renderAdminHtml } from "./page";

test("renderAdminHtml emits syntactically valid inline script", () => {
  const html = renderAdminHtml();
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert(match, "expected inline script tag in admin html");
  assert.doesNotThrow(() => {
    // Parse the generated browser-side script so template-string escapes don't silently break the page.
    // eslint-disable-next-line no-new-func
    new Function(match[1]);
  });
});

test("renderAdminHtml uses consolidated hero layout with shared navigation", () => {
  const html = renderAdminHtml("anthropic", null, { section: "log" });
  assert.match(html, /aria-label="功能侧边栏"/);
  assert.match(html, /class="workbench-link active" href="\/__log"/);
  assert.match(html, /class="workbench-sublink active" href="\/__log\/anthropic"/);
  assert.match(html, /class="console-hero card"/);
  assert.match(html, /Logs \/ Anthropic/);
  assert.match(html, /id="msg"/);
  assert.match(html, /href="\/__log\/anthropic"/);
  assert.match(html, /Anthropic/);
  assert.match(html, /保存归档设置/);
  assert.match(html, /归档设置/);
  assert.match(html, /列表操作/);
  assert.match(html, /已归档日志列表/);
  assert.match(html, /危险操作/);
  assert.match(html, /id="toggleJsonBtn"/);
  assert.match(html, /id="copyJsonBtn"/);
  assert.match(html, /id="closeJsonBtn"/);
  assert.match(html, /id="responseModeBadge"/);
  assert.doesNotMatch(html, /aria-label="页面入口"/);
  assert.doesNotMatch(html, /log\.viewer/);
  assert.doesNotMatch(html, /raw-first/);
  assert.doesNotMatch(html, /class="view-switch" aria-label="日志筛选入口"/);
  assert.doesNotMatch(html, /id="workflowGenerateBtn"/);
  assert.doesNotMatch(html, /Loop 负责工作流/);
});

test("renderAdminHtml router page keeps only primary state and action copy", () => {
  const html = renderAdminHtml("all", null, { section: "router" });
  assert.match(html, /Settings \/ Router/);
  assert.match(html, /监听地址/);
  assert.match(html, /General/);
  assert.match(html, /Routing/);
  assert.match(html, /Providers/);
  assert.match(html, /添加上游/);
  assert.doesNotMatch(html, /建议先设置默认上游/);
  assert.doesNotMatch(html, /保存配置会写回配置文件并立即生效/);
});

test("renderAdminHtml log page bootstraps config through render path", () => {
  const html = renderAdminHtml("all", null, { section: "log" });
  assert.match(html, /state = await r\.json\(\);\s*render\(\);/);
  assert.match(html, /state = INITIAL_CONFIG;\s*render\(\);/);
  assert.match(html, /暂无详情/);
  assert.match(html, /无结果/);
  assert.match(html, /responseModeBadge\.textContent = payload\?\.response\?\.isSse \? "SSE 聚合" : "原始响应"/);
  assert.doesNotMatch(html, /当前没有 OpenAI 日志详情/);
  assert.doesNotMatch(html, /当前没有 Anthropic 日志详情/);
  assert.doesNotMatch(html, /OpenAI \/ 1分钟/);
  assert.doesNotMatch(html, /ClaudeCode \/ 1分钟/);
});
