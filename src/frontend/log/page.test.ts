import test from "node:test";
import assert from "node:assert/strict";
import { renderLogHtml } from "./page";

test("renderLogHtml emits syntactically valid inline script", () => {
  const html = renderLogHtml();
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert(match, "expected inline script tag in log html");
  assert.doesNotThrow(() => {
    // eslint-disable-next-line no-new-func
    new Function(match[1]);
  });
  assert.match(html, /<title>AgentLens Logs \(All\)<\/title>/);
  assert.match(html, /href="\/__log"/);
  assert.match(html, /Logs \/ All/);
  assert.match(html, /保存归档设置/);
  assert.match(html, /已归档日志列表/);
  assert.match(html, /id="archiveRequests"/);
  assert.match(html, /id="logAutoBtn"/);
  assert.match(html, /id="logCleanupAllBtn"/);
  assert.match(html, /id="closeJsonBtn"/);
  assert.match(html, /危险操作/);
  assert.match(html, /id="responseModeBadge"/);
  assert.doesNotMatch(html, /id="providersList"/);
  assert.doesNotMatch(html, /id="workflowExportLoopBtn"/);
  assert.doesNotMatch(html, /这里只切换当前日志视图，不会离开当前页面/);
  assert.doesNotMatch(html, /原生请求优先/);
});
