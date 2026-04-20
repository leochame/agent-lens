import test from "node:test";
import assert from "node:assert/strict";
import { renderWorkbenchSidebar } from "./shell";

test("renderWorkbenchSidebar expands log children and marks the active sub-page", () => {
  const html = renderWorkbenchSidebar("/__log/openai");
  assert.match(html, /class="workbench-link active" href="\/__log"/);
  assert.match(html, /class="workbench-sublink active" href="\/__log\/openai"/);
  assert.match(html, /class="workbench-sublink" href="\/__log\/anthropic"/);
  assert.match(html, /href="\/__home"/);
  assert.match(html, /href="\/__router"/);
  assert.match(html, /href="\/__loop"/);
  assert.match(html, /AgentLens<\/strong>/);
  assert.doesNotMatch(html, /Workspace/);
  assert.doesNotMatch(html, /Project/);
  assert.doesNotMatch(html, />打开</);
});
