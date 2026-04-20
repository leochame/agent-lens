import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { archiveRecordFilePath, legacyArchiveByRequestFilePath } from "./service/archive-path";
import { cleanupArchivedLogs, loadArchivedLogDetail, loadPairedLogs } from "./archive";

test("loadArchivedLogDetail returns nulls when archive is missing even if jsonl summary exists", async () => {
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
    assert.equal(detail.request, null);
    assert.equal(detail.response, null);
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

test("loadArchivedLogDetail ignores legacy archive paths for admin detail reads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-admin-logs-test-"));
  try {
    const logPath = join(dir, "requests.jsonl");
    const requestId = "req-legacy-detail-only";
    const legacyRequestPath = legacyArchiveByRequestFilePath(logPath, requestId, "request");
    const legacyResponsePath = legacyArchiveByRequestFilePath(logPath, requestId, "response");
    await mkdir(dirname(legacyRequestPath), { recursive: true });
    await writeFile(legacyRequestPath, JSON.stringify({ requestId, type: "request", body: { encoding: "utf8", text: "{\"prompt\":\"hello\"}" } }), "utf8");
    await writeFile(legacyResponsePath, JSON.stringify({ requestId, type: "response", body: { encoding: "utf8", text: "{\"output\":\"world\"}" } }), "utf8");

    const detail = await loadArchivedLogDetail(logPath, requestId, "openai", null);
    assert.equal(detail.request, null);
    assert.equal(detail.response, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadPairedLogs only returns requestIds with archived detail files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-admin-logs-test-"));
  try {
    const logPath = join(dir, "requests.jsonl");
    const archivedId = "req-archived-1";
    const summaryOnlyId = "req-summary-only-1";
    const lines = [
      JSON.stringify({
        type: "request",
        ts: "2026-03-26T03:15:40.439Z",
        requestId: archivedId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses"
      }),
      JSON.stringify({
        type: "response",
        ts: "2026-03-26T03:15:41.439Z",
        requestId: archivedId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses",
        statusCode: 200
      }),
      JSON.stringify({
        type: "request",
        ts: "2026-03-26T03:16:40.439Z",
        requestId: summaryOnlyId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses"
      }),
      JSON.stringify({
        type: "response",
        ts: "2026-03-26T03:16:41.439Z",
        requestId: summaryOnlyId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses",
        statusCode: 200
      })
    ];
    await writeFile(join(dir, "requests.openai.jsonl"), `${lines.join("\n")}\n`, "utf8");

    const requestArchivePath = archiveRecordFilePath(logPath, null, archivedId, "request", "openai");
    const responseArchivePath = archiveRecordFilePath(logPath, null, archivedId, "response", "openai");
    await mkdir(dirname(requestArchivePath), { recursive: true });
    await mkdir(dirname(responseArchivePath), { recursive: true });
    await writeFile(requestArchivePath, JSON.stringify({ requestId: archivedId, type: "request", body: { encoding: "utf8", text: "{}" } }), "utf8");
    await writeFile(responseArchivePath, JSON.stringify({ requestId: archivedId, type: "response", body: { encoding: "utf8", text: "{}" } }), "utf8");

    const items = await loadPairedLogs(logPath, 20, "openai");
    assert.equal(items.length, 1);
    assert.equal(items[0]?.requestId, archivedId);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadPairedLogs excludes requestIds when only one archived detail half exists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-admin-logs-test-"));
  try {
    const logPath = join(dir, "requests.jsonl");
    const fullyArchivedId = "req-archived-both";
    const requestOnlyArchivedId = "req-archived-request-only";
    const responseOnlyArchivedId = "req-archived-response-only";
    const lines = [
      JSON.stringify({
        type: "request",
        ts: "2026-03-26T03:15:40.439Z",
        requestId: fullyArchivedId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses"
      }),
      JSON.stringify({
        type: "response",
        ts: "2026-03-26T03:15:41.439Z",
        requestId: fullyArchivedId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses",
        statusCode: 200
      }),
      JSON.stringify({
        type: "request",
        ts: "2026-03-26T03:16:40.439Z",
        requestId: requestOnlyArchivedId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses"
      }),
      JSON.stringify({
        type: "response",
        ts: "2026-03-26T03:16:41.439Z",
        requestId: requestOnlyArchivedId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses",
        statusCode: 200
      }),
      JSON.stringify({
        type: "request",
        ts: "2026-03-26T03:17:40.439Z",
        requestId: responseOnlyArchivedId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses"
      }),
      JSON.stringify({
        type: "response",
        ts: "2026-03-26T03:17:41.439Z",
        requestId: responseOnlyArchivedId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses",
        statusCode: 200
      })
    ];
    await writeFile(join(dir, "requests.openai.jsonl"), `${lines.join("\n")}\n`, "utf8");

    const fullyArchivedRequestPath = archiveRecordFilePath(logPath, null, fullyArchivedId, "request", "openai");
    const fullyArchivedResponsePath = archiveRecordFilePath(logPath, null, fullyArchivedId, "response", "openai");
    const requestOnlyPath = archiveRecordFilePath(logPath, null, requestOnlyArchivedId, "request", "openai");
    const responseOnlyPath = archiveRecordFilePath(logPath, null, responseOnlyArchivedId, "response", "openai");

    await mkdir(dirname(fullyArchivedRequestPath), { recursive: true });
    await mkdir(dirname(fullyArchivedResponsePath), { recursive: true });
    await mkdir(dirname(requestOnlyPath), { recursive: true });
    await mkdir(dirname(responseOnlyPath), { recursive: true });

    await writeFile(fullyArchivedRequestPath, JSON.stringify({ requestId: fullyArchivedId, type: "request", body: { encoding: "utf8", text: "{}" } }), "utf8");
    await writeFile(fullyArchivedResponsePath, JSON.stringify({ requestId: fullyArchivedId, type: "response", body: { encoding: "utf8", text: "{}" } }), "utf8");
    await writeFile(requestOnlyPath, JSON.stringify({ requestId: requestOnlyArchivedId, type: "request", body: { encoding: "utf8", text: "{}" } }), "utf8");
    await writeFile(responseOnlyPath, JSON.stringify({ requestId: responseOnlyArchivedId, type: "response", body: { encoding: "utf8", text: "{}" } }), "utf8");

    const items = await loadPairedLogs(logPath, 20, "openai");
    assert.deepEqual(items.map((item) => item.requestId), [fullyArchivedId]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadPairedLogs ignores legacy archived pairs when the new archive layout is missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-admin-logs-test-"));
  try {
    const logPath = join(dir, "requests.jsonl");
    const requestId = "req-legacy-list-only";
    const lines = [
      JSON.stringify({
        type: "request",
        ts: "2026-03-26T03:15:40.439Z",
        requestId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses"
      }),
      JSON.stringify({
        type: "response",
        ts: "2026-03-26T03:15:41.439Z",
        requestId,
        apiFormat: "openai",
        method: "POST",
        path: "/responses",
        statusCode: 200
      })
    ];
    await writeFile(join(dir, "requests.openai.jsonl"), `${lines.join("\n")}\n`, "utf8");

    const legacyRequestPath = legacyArchiveByRequestFilePath(logPath, requestId, "request");
    const legacyResponsePath = legacyArchiveByRequestFilePath(logPath, requestId, "response");
    await mkdir(dirname(legacyRequestPath), { recursive: true });
    await writeFile(legacyRequestPath, JSON.stringify({ requestId, type: "request", body: { encoding: "utf8", text: "{}" } }), "utf8");
    await writeFile(legacyResponsePath, JSON.stringify({ requestId, type: "response", body: { encoding: "utf8", text: "{}" } }), "utf8");

    const items = await loadPairedLogs(logPath, 20, "openai");
    assert.deepEqual(items, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cleanupArchivedLogs removes failed request summaries and archived detail together", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-admin-logs-test-"));
  try {
    const logPath = join(dir, "requests.jsonl");
    const requestId = "req-cleanup-failed-1";
    const requestLine = JSON.stringify({
      type: "request",
      ts: "2026-03-26T03:15:40.439Z",
      requestId,
      apiFormat: "openai",
      method: "POST",
      path: "/responses"
    });
    const responseLine = JSON.stringify({
      type: "response",
      ts: "2026-03-26T03:15:41.439Z",
      requestId,
      apiFormat: "openai",
      method: "POST",
      path: "/responses",
      statusCode: 502
    });
    await writeFile(join(dir, "requests.openai.jsonl"), `${requestLine}\n${responseLine}\n`, "utf8");

    const requestArchivePath = archiveRecordFilePath(logPath, null, requestId, "request", "openai");
    const responseArchivePath = archiveRecordFilePath(logPath, null, requestId, "response", "openai");
    await mkdir(dirname(requestArchivePath), { recursive: true });
    await mkdir(dirname(responseArchivePath), { recursive: true });
    await writeFile(requestArchivePath, JSON.stringify({ requestId, type: "request" }), "utf8");
    await writeFile(responseArchivePath, JSON.stringify({ requestId, type: "response" }), "utf8");

    const result = await cleanupArchivedLogs(logPath, "failed", "openai");
    assert.deepEqual(result, { removedRequests: 1, removedRecords: 2 });
    assert.deepEqual(await loadPairedLogs(logPath, 20, "openai"), []);
    assert.deepEqual(await loadArchivedLogDetail(logPath, requestId, "openai", null), { request: null, response: null });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
