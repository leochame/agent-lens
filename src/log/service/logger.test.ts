import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LoggerService } from "./logger";
import { LoggingConfig } from "../../router/provider/types";
import { archiveRecordFilePath } from "./archive-path";

test("LoggerService bounds requestSessionMap growth", async () => {
  const cfg: LoggingConfig = {
    filePath: "/tmp/agent-lens-logger-test.log",
    archiveRequests: true
  };
  const logger = new LoggerService(cfg) as unknown as {
    logRequest: (payload: {
      ts: string;
      requestId: string;
      method: string;
      path: string;
      provider: string;
      headers: Record<string, string>;
      rawBody: Buffer;
      contentType?: string;
    }) => void;
    writeChain: Promise<void>;
    requestSessionMap: Map<string, string | null>;
    appendRecord: (record: unknown) => Promise<void>;
    appendArchiveRecord: (record: unknown, body: Buffer, contentType?: string) => Promise<void>;
  };

  logger.appendRecord = async () => {};
  logger.appendArchiveRecord = async () => {};

  for (let i = 0; i < 5200; i += 1) {
    logger.logRequest({
      ts: new Date().toISOString(),
      requestId: `req-${i}`,
      method: "POST",
      path: "/v1/chat/completions",
      provider: "openai",
      headers: { "x-session-id": `s-${i}` },
      rawBody: Buffer.from("{}", "utf8"),
      contentType: "application/json"
    });
  }

  await logger.writeChain;
  assert.ok(logger.requestSessionMap.size <= 5000);
  assert.equal(logger.requestSessionMap.has("req-0"), false);
  assert.equal(logger.requestSessionMap.has("req-5199"), true);
});

test("LoggerService still writes summary records when archiveRequests is disabled", async () => {
  const cfg: LoggingConfig = {
    filePath: "/tmp/agent-lens-logger-test.log",
    archiveRequests: false
  };
  const logger = new LoggerService(cfg) as unknown as {
    logRequest: (payload: {
      ts: string;
      requestId: string;
      method: string;
      path: string;
      provider: string;
      headers: Record<string, string>;
      rawBody: Buffer;
      contentType?: string;
    }) => void;
    logResponse: (payload: {
      ts: string;
      requestId: string;
      method: string;
      path: string;
      provider: string;
      statusCode: number;
      headers: Record<string, string>;
      rawBody: Buffer;
      contentType?: string;
      truncated: boolean;
    }) => void;
    writeChain: Promise<void>;
    appendRecord: (record: unknown) => Promise<void>;
    appendArchiveRecord: (record: unknown, body: Buffer, contentType?: string) => Promise<void>;
  };
  let appendRecordCalls = 0;
  let appendArchiveCalls = 0;
  logger.appendRecord = async () => {
    appendRecordCalls += 1;
  };
  logger.appendArchiveRecord = async () => {
    appendArchiveCalls += 1;
  };

  logger.logRequest({
    ts: new Date().toISOString(),
    requestId: "req-disabled-1",
    method: "POST",
    path: "/v1/chat/completions",
    provider: "openai",
    headers: {},
    rawBody: Buffer.from("{}", "utf8"),
    contentType: "application/json"
  });
  logger.logResponse({
    ts: new Date().toISOString(),
    requestId: "req-disabled-1",
    method: "POST",
    path: "/v1/chat/completions",
    provider: "openai",
    statusCode: 200,
    headers: {},
    rawBody: Buffer.from("{}", "utf8"),
    contentType: "application/json",
    truncated: false
  });

  await logger.writeChain;
  assert.equal(appendRecordCalls, 2);
  assert.equal(appendArchiveCalls, 0);
});

test("LoggerService clears requestSessionMap on response even when logging is disabled", async () => {
  const cfg: LoggingConfig = {
    filePath: "/tmp/agent-lens-logger-test.log",
    archiveRequests: false
  };
  const logger = new LoggerService(cfg) as unknown as {
    logResponse: (payload: {
      ts: string;
      requestId: string;
      method: string;
      path: string;
      provider: string;
      statusCode: number;
      headers: Record<string, string>;
      rawBody: Buffer;
      contentType?: string;
      truncated: boolean;
    }) => void;
    writeChain: Promise<void>;
    requestSessionMap: Map<string, string | null>;
  };

  logger.requestSessionMap.set("req-disabled-cleanup", "s-1");
  logger.logResponse({
    ts: new Date().toISOString(),
    requestId: "req-disabled-cleanup",
    method: "POST",
    path: "/v1/chat/completions",
    provider: "openai",
    statusCode: 200,
    headers: {},
    rawBody: Buffer.from("{}", "utf8"),
    contentType: "application/json",
    truncated: false
  });

  await logger.writeChain;
  assert.equal(logger.requestSessionMap.has("req-disabled-cleanup"), false);
});

test("LoggerService classifies OpenAI image-style routes as openai", async () => {
  const cfg: LoggingConfig = {
    filePath: "/tmp/agent-lens-logger-test.log",
    archiveRequests: false
  };
  const logger = new LoggerService(cfg) as unknown as {
    logRequest: (payload: {
      ts: string;
      requestId: string;
      method: string;
      path: string;
      provider: string;
      headers: Record<string, string>;
      rawBody: Buffer;
      contentType?: string;
    }) => void;
    writeChain: Promise<void>;
    appendRecord: (record: { apiFormat?: string }) => Promise<void>;
    appendArchiveRecord: (record: unknown, body: Buffer, contentType?: string) => Promise<void>;
  };
  const capturedFormats: string[] = [];
  logger.appendRecord = async (record) => {
    capturedFormats.push(String(record.apiFormat || ""));
  };
  logger.appendArchiveRecord = async () => {};

  logger.logRequest({
    ts: new Date().toISOString(),
    requestId: "req-openai-images-1",
    method: "POST",
    path: "/v1/images",
    provider: "openai",
    headers: {},
    rawBody: Buffer.from("{}", "utf8"),
    contentType: "application/json"
  });

  await logger.writeChain;
  assert.deepEqual(capturedFormats, ["openai"]);
});

test("LoggerService preserves archived history across more than 100 request pairs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-logger-retention-"));
  const cfg: LoggingConfig = {
    filePath: join(dir, "requests.jsonl"),
    archiveRequests: true
  };
  const logger = new LoggerService(cfg);

  try {
    for (let i = 0; i < 101; i += 1) {
      const requestId = `req-${i}`;
      const headers = { "x-session-id": `session-${i}` };
      logger.logRequest({
        ts: new Date(2026, 0, 1, 0, 0, i).toISOString(),
        requestId,
        method: "POST",
        path: "/v1/chat/completions",
        provider: "openai",
        headers,
        rawBody: Buffer.from(`{"i":${i}}`, "utf8"),
        contentType: "application/json"
      });
      logger.logResponse({
        ts: new Date(2026, 0, 1, 0, 1, i).toISOString(),
        requestId,
        method: "POST",
        path: "/v1/chat/completions",
        provider: "openai",
        statusCode: 200,
        headers,
        rawBody: Buffer.from(`{"id":"${requestId}","output_text":"ok"}`, "utf8"),
        contentType: "application/json",
        truncated: false
      });
    }

    await (logger as unknown as { writeChain: Promise<void> }).writeChain;

    const aggregateLines = (await readFile(cfg.filePath, "utf8")).trim().split("\n");
    const openaiPath = join(dir, "requests.openai.jsonl");
    const openaiLines = (await readFile(openaiPath, "utf8")).trim().split("\n");

    assert.equal(aggregateLines.length, 202);
    assert.equal(openaiLines.length, 202);
    assert.equal(aggregateLines.some((line) => line.includes("\"requestId\":\"req-0\"")), true);
    assert.equal(aggregateLines.some((line) => line.includes("\"requestId\":\"req-100\"")), true);

    const oldArchive = archiveRecordFilePath(cfg.filePath, null, "req-0", "request", "openai");
    const newArchive = archiveRecordFilePath(cfg.filePath, null, "req-100", "request", "openai");

    assert.match(await readFile(oldArchive, "utf8"), /"requestId": "req-0"/);
    assert.match(await readFile(newArchive, "utf8"), /"requestId": "req-100"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("LoggerService archives the original request body without rewriting it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-logger-raw-archive-"));
  const cfg: LoggingConfig = {
    filePath: join(dir, "requests.jsonl"),
    archiveRequests: true
  };
  const logger = new LoggerService(cfg);
  const requestId = "req-raw-request-1";
  const rawText = [
    "{",
    "  \"model\": \"gpt-5\",",
    "  \"input\": \"line1\\nline2\",",
    "  \"meta\": { \"keepSpacing\": true }",
    "}"
  ].join("\n");

  try {
    logger.logRequest({
      ts: new Date().toISOString(),
      requestId,
      method: "POST",
      path: "/v1/responses",
      provider: "openai",
      headers: { "content-type": "application/json; charset=utf-8" },
      rawBody: Buffer.from(rawText, "utf8"),
      contentType: "application/json; charset=utf-8"
    });

    await (logger as unknown as { writeChain: Promise<void> }).writeChain;

    const archivePath = archiveRecordFilePath(cfg.filePath, null, requestId, "request", "openai");
    const archived = JSON.parse(await readFile(archivePath, "utf8")) as {
      body?: { encoding?: string; text?: string; byteLength?: number };
    };

    assert.equal(archived.body?.encoding, "utf8");
    assert.equal(archived.body?.text, rawText);
    assert.equal(archived.body?.byteLength, Buffer.byteLength(rawText, "utf8"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
