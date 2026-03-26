import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadArchivedLogDetail } from "./logs";

test("loadArchivedLogDetail falls back to jsonl when archive is missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-admin-logs-test-"));
  try {
    const logPath = join(dir, "requests.jsonl");
    const requestId = "req-jsonl-fallback-1";
    const requestLine = JSON.stringify({
      type: "request",
      ts: "2026-03-26T03:15:40.439Z",
      requestId,
      apiFormat: "openai",
      method: "POST",
      path: "/responses",
      model: "gpt-5",
      stream: true,
      messages: [{ role: "user", preview: "hello" }],
      toolCalls: []
    });
    const responseLine = JSON.stringify({
      type: "response",
      ts: "2026-03-26T03:15:41.439Z",
      requestId,
      apiFormat: "openai",
      method: "POST",
      path: "/responses",
      statusCode: 200,
      responsePreview: "world",
      responseMessages: [{ role: "assistant", preview: "world" }],
      toolCalls: [],
      finishReason: "stop"
    });
    await writeFile(join(dir, "requests.openai.jsonl"), `${requestLine}\n${responseLine}\n`, "utf8");

    const detail = await loadArchivedLogDetail(logPath, requestId, "openai", null);
    assert.ok(detail.request);
    assert.ok(detail.response);

    const requestRecord = detail.request as { body?: { text?: string } };
    const responseRecord = detail.response as { body?: { text?: string }; statusCode?: number };
    assert.equal(typeof requestRecord.body?.text, "string");
    assert.equal(typeof responseRecord.body?.text, "string");
    assert.equal(responseRecord.statusCode, 200);

    const requestPayload = JSON.parse(requestRecord.body?.text || "{}") as { model?: string };
    const responsePayload = JSON.parse(responseRecord.body?.text || "{}") as { responsePreview?: string };
    assert.equal(requestPayload.model, "gpt-5");
    assert.equal(responsePayload.responsePreview, "world");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadArchivedLogDetail returns nulls when neither archive nor jsonl exists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-admin-logs-test-"));
  try {
    const logPath = join(dir, "requests.jsonl");
    const detail = await loadArchivedLogDetail(logPath, "missing-id", "openai", null);
    assert.equal(detail.request, null);
    assert.equal(detail.response, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

