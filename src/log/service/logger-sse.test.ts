import test from "node:test";
import assert from "node:assert/strict";
import { LoggerService } from "./logger";
import { LoggingConfig } from "../../router/provider/types";

type CapturedRecord = Record<string, unknown>;

function createLoggerCapture(): {
  logger: any;
  records: CapturedRecord[];
} {
  const cfg: LoggingConfig = {
    filePath: "/tmp/agent-lens-logger-sse-test.log",
    archiveRequests: true
  };
  const logger = new LoggerService(cfg) as any;
  const records: CapturedRecord[] = [];
  logger.appendRecord = async (record: CapturedRecord) => {
    records.push(record);
  };
  logger.appendArchiveRecord = async () => {};
  return { logger, records };
}

test("LoggerService summarizes OpenAI SSE text and finish_reason", async () => {
  const { logger, records } = createLoggerCapture();
  const sse = [
    'data: {"choices":[{"delta":{"content":"Hello "}}]}',
    'data: {"choices":[{"delta":{"content":"world"},"finish_reason":"stop"}]}',
    "data: [DONE]"
  ].join("\n");

  logger.logResponse({
    ts: new Date().toISOString(),
    requestId: "sse-openai-text",
    method: "POST",
    path: "/v1/chat/completions",
    provider: "openai",
    statusCode: 200,
    headers: {},
    rawBody: Buffer.from(sse, "utf8"),
    contentType: "text/event-stream",
    truncated: false
  });

  await logger.writeChain;
  assert.equal(records.length, 1);
  const rec = records[0];
  assert.equal(rec.apiFormat, "openai");
  assert.equal(rec.responsePreview, "Hello world");
  assert.equal(rec.finishReason, "stop");
});

test("LoggerService reconstructs OpenAI SSE tool call arguments across chunks", async () => {
  const { logger, records } = createLoggerCapture();
  const sse = [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"grep","arguments":"{\\"q\\":\\"hel"}}]}}]}',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"lo\\"}"}}]}}]}',
    "data: [DONE]"
  ].join("\n");

  logger.logResponse({
    ts: new Date().toISOString(),
    requestId: "sse-openai-tool",
    method: "POST",
    path: "/v1/chat/completions",
    provider: "openai",
    statusCode: 200,
    headers: {},
    rawBody: Buffer.from(sse, "utf8"),
    contentType: "text/event-stream",
    truncated: false
  });

  await logger.writeChain;
  assert.equal(records.length, 1);
  const rec = records[0];
  const toolCalls = Array.isArray(rec.toolCalls) ? rec.toolCalls : [];
  assert.ok(toolCalls.length >= 1);
  const first = toolCalls[0] as Record<string, unknown>;
  assert.equal(first.name, "grep");
  assert.equal(first.id, "call_1");
  assert.match(String(first.argumentsPreview || ""), /"q":"hello"/);
});

test("LoggerService summarizes Anthropic SSE tool_use blocks", async () => {
  const { logger, records } = createLoggerCapture();
  const sse = [
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"search"}}',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"keyword\\":\\"cod"}}',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"ex\\"}"}}',
    'data: {"type":"content_block_stop","index":0}',
    'data: {"type":"message_stop","stop_reason":"end_turn"}'
  ].join("\n");

  logger.logResponse({
    ts: new Date().toISOString(),
    requestId: "sse-anth-tool",
    method: "POST",
    path: "/v1/messages",
    provider: "anthropic",
    statusCode: 200,
    headers: { "anthropic-version": "2023-06-01" },
    rawBody: Buffer.from(sse, "utf8"),
    contentType: "text/event-stream",
    truncated: false
  });

  await logger.writeChain;
  assert.equal(records.length, 1);
  const rec = records[0];
  assert.equal(rec.apiFormat, "anthropic");
  assert.equal(rec.finishReason, "end_turn");
  const toolCalls = Array.isArray(rec.toolCalls) ? rec.toolCalls : [];
  assert.ok(toolCalls.length >= 1);
  const matched = toolCalls
    .map((x) => x as Record<string, unknown>)
    .find((x) => x.name === "search" && x.id === "toolu_1" && /"keyword":"codex"/.test(String(x.argumentsPreview || "")));
  assert.ok(matched);
});
