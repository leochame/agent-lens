import test from "node:test";
import assert from "node:assert/strict";
import { LoggerService } from "./logger";
import { LoggingConfig } from "../provider-router/types";

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

test("LoggerService writes nothing when archiveRequests is disabled", async () => {
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
  assert.equal(appendRecordCalls, 0);
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
