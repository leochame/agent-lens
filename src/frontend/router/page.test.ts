import test from "node:test";
import assert from "node:assert/strict";
import { renderRouterHtml } from "./page";

test("renderRouterHtml emits syntactically valid inline script", () => {
  const html = renderRouterHtml();
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert(match, "expected inline script tag in router html");
  assert.doesNotThrow(() => {
    // eslint-disable-next-line no-new-func
    new Function(match[1]);
  });
  assert.match(html, /href="\/__router"/);
  assert.match(html, /Settings \/ Router/);
  assert.match(html, /已加载/);
  assert.match(html, /General/);
  assert.match(html, /Routing/);
  assert.match(html, /Providers/);
  assert.match(html, /<h2>上游<\/h2>/);
  assert.doesNotMatch(html, /id="archiveRequests"/);
  assert.doesNotMatch(html, /id="logList"/);
  assert.doesNotMatch(html, /建议先设置默认上游/);
});
