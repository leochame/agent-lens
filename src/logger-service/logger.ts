import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { IncomingHttpHeaders } from "node:http";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { LoggingConfig } from "../provider-router/types";
import { archiveRecordFilePath } from "./archive-path";

export type RequestLogPayload = {
  ts: string;
  requestId: string;
  method: string;
  path: string;
  provider: string;
  headers: IncomingHttpHeaders;
  rawBody: Buffer;
  contentType?: string;
};

export type ResponseLogPayload = {
  ts: string;
  requestId: string;
  method: string;
  path: string;
  provider: string;
  statusCode: number;
  headers: IncomingHttpHeaders;
  rawBody: Buffer;
  contentType?: string;
  truncated: boolean;
};

type LogRecord = {
  type: "request" | "response";
  ts: string;
  requestId: string;
  sessionId: string | null;
  method: string;
  path: string;
  provider: string;
  apiFormat: "anthropic" | "openai" | "unknown";
  model: string | null;
  stream: boolean | null;
  systemPromptPreview?: string | null;
  messages?: MessageSummary[];
  tools?: string[];
  toolCalls?: ToolCallSummary[];
  responsePreview?: string | null;
  responseMessages?: MessageSummary[];
  usage?: unknown;
  finishReason?: string | null;
  statusCode?: number;
  parseError: string | null;
  truncated?: boolean;
};

type MessageSummary = {
  role: string;
  preview: string;
  kind?: "text" | "system" | "tool_call" | "tool_result";
  toolName?: string | null;
  toolCallId?: string | null;
};

type ToolCallSummary = {
  source: "request" | "response" | "stream";
  name: string;
  id: string | null;
  argumentsPreview: string | null;
  resultPreview: string | null;
};

type ArchivedDetailRecord = {
  schemaVersion: 1;
  capturedAt: string;
  requestId: string;
  sessionId: string | null;
  type: "request" | "response";
  method: string;
  path: string;
  provider: string;
  apiFormat: "anthropic" | "openai" | "unknown";
  contentType: string | null;
  statusCode?: number;
  truncated?: boolean;
  isSse: boolean;
  body: {
    encoding: "utf8" | "base64";
    text?: string;
    base64?: string;
    byteLength: number;
  };
  sse?: {
    eventCount: number;
    doneSeen: boolean;
    events: Array<{ event: string | null; data: string }>;
  };
};

function parseJsonIfPossible(body: Buffer, contentType?: string): { jsonBody: unknown | null; parseError: string | null } {
  const ct = contentType?.toLowerCase() ?? "";
  if (!ct.includes("application/json")) {
    return { jsonBody: null, parseError: null };
  }

  try {
    const parsed = JSON.parse(body.toString("utf8"));
    return { jsonBody: parsed, parseError: null };
  } catch (error) {
    const parseError = error instanceof Error ? error.message : "Unknown parse error";
    return { jsonBody: null, parseError };
  }
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function normalizePreviewText(text: string, _maxLen = 2400): string {
  // Keep agent-related message/tool/tool_call content complete (no truncation).
  return String(text ?? "").replace(/\r\n?/g, "\n");
}

function stripUselessChars(text: string): string {
  // Keep archived raw request/response as-is for forensic troubleshooting.
  return String(text ?? "");
}

function previewFromUnknown(value: unknown, maxLen = 2400): string {
  if (typeof value === "string") {
    return normalizePreviewText(value, maxLen);
  }
  try {
    return normalizePreviewText(JSON.stringify(value), maxLen);
  } catch {
    return normalizePreviewText(String(value), maxLen);
  }
}

function extractTextFromOpenAiContentPart(
  part: Record<string, unknown>
): string {
  const t = asString(part.type);
  const direct = asString(part.text || part.output_text || part.input_text || part.content);
  if (direct) {
    return direct;
  }
  return "";
}

function pushMessage(target: MessageSummary[], message: MessageSummary): void {
  const preview = normalizePreviewText(message.preview || "");
  if (!preview) {
    return;
  }
  target.push({
    role: message.role || "unknown",
    preview,
    kind: message.kind,
    toolName: message.toolName ?? null,
    toolCallId: message.toolCallId ?? null
  });
}

function pushToolCall(target: ToolCallSummary[], toolCall: ToolCallSummary): void {
  const name = normalizePreviewText(toolCall.name || "", 200);
  if (!name) {
    return;
  }
  const next = {
    source: toolCall.source,
    name,
    id: toolCall.id ?? null,
    argumentsPreview: toolCall.argumentsPreview ? normalizePreviewText(toolCall.argumentsPreview, 2400) : null,
    resultPreview: toolCall.resultPreview ? normalizePreviewText(toolCall.resultPreview, 2400) : null
  } satisfies ToolCallSummary;
  const key = `${next.source}|${next.name}|${next.id ?? ""}|${next.argumentsPreview ?? ""}|${next.resultPreview ?? ""}`;
  const exists = target.some((item) => {
    const itemKey = `${item.source}|${item.name}|${item.id ?? ""}|${item.argumentsPreview ?? ""}|${item.resultPreview ?? ""}`;
    return itemKey === key;
  });
  if (!exists) {
    target.push(next);
  }
}

function isTextLikeContentType(contentType?: string): boolean {
  const ct = (contentType ?? "").toLowerCase();
  return (
    ct.startsWith("text/") ||
    ct.includes("json") ||
    ct.includes("xml") ||
    ct.includes("javascript") ||
    ct.includes("x-www-form-urlencoded") ||
    ct.includes("event-stream")
  );
}

function parseSseForArchive(text: string): {
  eventCount: number;
  doneSeen: boolean;
  events: Array<{ event: string | null; data: string }>;
} {
  const lines = stripUselessChars(text).split("\n");
  const events: Array<{ event: string | null; data: string }> = [];
  let eventName: string | null = null;
  let dataLines: string[] = [];
  let doneSeen = false;

  const flush = (): void => {
    if (dataLines.length === 0 && !eventName) {
      return;
    }
    const data = dataLines.join("\n");
    if (data.trim() === "[DONE]") {
      doneSeen = true;
    }
    events.push({ event: eventName, data: normalizePreviewText(data, 30000) });
    eventName = null;
    dataLines = [];
  };

  for (const line of lines) {
    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() || null;
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  flush();
  return { eventCount: events.length, doneSeen, events };
}

function toArchivedBody(rawBody: Buffer, contentType?: string): {
  encoding: "utf8" | "base64";
  text?: string;
  base64?: string;
  byteLength: number;
} {
  if (isTextLikeContentType(contentType)) {
    return {
      encoding: "utf8",
      text: stripUselessChars(rawBody.toString("utf8")),
      byteLength: rawBody.length
    };
  }
  return {
    encoding: "base64",
    base64: rawBody.toString("base64"),
    byteLength: rawBody.length
  };
}

function decodeResponseBody(rawBody: Buffer, headers: IncomingHttpHeaders): Buffer {
  const enc = Array.isArray(headers["content-encoding"])
    ? headers["content-encoding"][0]
    : headers["content-encoding"];
  const encoding = (enc ?? "").toLowerCase();
  if (!encoding) {
    return rawBody;
  }

  try {
    if (encoding.includes("gzip")) {
      return gunzipSync(rawBody);
    }
    if (encoding.includes("br")) {
      return brotliDecompressSync(rawBody);
    }
    if (encoding.includes("deflate")) {
      return inflateSync(rawBody);
    }
  } catch {
    return rawBody;
  }
  return rawBody;
}

function detectApiFormat(path: string, headers: IncomingHttpHeaders): "anthropic" | "openai" | "unknown" {
  const p = (path || "").split("?")[0];
  if (headers["anthropic-version"] || p === "/v1/messages" || p === "/v1/complete") {
    return "anthropic";
  }
  if (
    p.startsWith("/v1/responses") ||
    p.startsWith("/v1/chat/completions") ||
    p.startsWith("/v1/completions") ||
    p.startsWith("/v1/embeddings")
  ) {
    return "openai";
  }
  return "unknown";
}

function getSessionId(headers: IncomingHttpHeaders): string | null {
  const candidates = [
    "x-session-id",
    "session-id",
    "x-request-id",
    "anthropic-session-id",
    "openai-session-id"
  ];
  for (const key of candidates) {
    const v = headers[key];
    const one = Array.isArray(v) ? v[0] : v;
    if (one) {
      return String(one);
    }
  }
  return null;
}

function flattenAnthropicContent(
  content: unknown,
  role: string,
  source: "request" | "response",
  tools: string[],
  toolCalls: ToolCallSummary[],
  messages: MessageSummary[]
): { text: string } {
  if (typeof content === "string") {
    return { text: normalizePreviewText(content) };
  }
  if (!Array.isArray(content)) {
    return { text: "" };
  }
  const texts: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const t = asString(entry.type);
    if (t === "text") {
      const text = asString(entry.text);
      if (text) {
        texts.push(text);
      }
      continue;
    }
    if (t === "tool_use") {
      const name = asString(entry.name) || "unknown_tool";
      const id = asString(entry.id) || null;
      const argsPreview = previewFromUnknown(entry.input ?? entry.arguments ?? null, 1600) || null;
      tools.push(name);
      pushToolCall(toolCalls, {
        source,
        name,
        id,
        argumentsPreview: argsPreview,
        resultPreview: null
      });
      pushMessage(messages, {
        role: role || "assistant",
        kind: "tool_call",
        toolName: name,
        toolCallId: id,
        preview: `${name}(${argsPreview ?? ""})`
      });
      continue;
    }
    if (t === "tool_result") {
      const id = asString(entry.tool_use_id || entry.id) || null;
      const resultPreview = previewFromUnknown(entry.content ?? entry.output ?? entry.result ?? null, 1600) || null;
      pushMessage(messages, {
        role: "tool",
        kind: "tool_result",
        toolCallId: id,
        preview: resultPreview ?? "(empty tool result)"
      });
      continue;
    }
    const fallbackText = asString(entry.text) || previewFromUnknown(entry, 800);
    if (fallbackText) {
      texts.push(fallbackText);
    }
  }
  return { text: normalizePreviewText(texts.join("\n")) };
}

function summarizeRequest(
  apiFormat: "anthropic" | "openai" | "unknown",
  jsonBody: unknown
): Pick<LogRecord, "model" | "stream" | "systemPromptPreview" | "messages" | "tools" | "toolCalls"> {
  const base = {
    model: null as string | null,
    stream: null as boolean | null,
    systemPromptPreview: null as string | null,
    messages: [] as MessageSummary[],
    tools: [] as string[],
    toolCalls: [] as ToolCallSummary[]
  };

  if (!jsonBody || typeof jsonBody !== "object") {
    return base;
  }
  const body = jsonBody as Record<string, unknown>;
  base.model = asString(body.model) || null;
  if (typeof body.stream === "boolean") {
    base.stream = body.stream;
  }

  if (apiFormat === "anthropic") {
    if (typeof body.system === "string") {
      base.systemPromptPreview = body.system;
      pushMessage(base.messages, { role: "system", kind: "system", preview: body.system });
    } else if (Array.isArray(body.system)) {
      const s = body.system
        .map((x) => (x && typeof x === "object" ? asString((x as Record<string, unknown>).text) : ""))
        .filter(Boolean)
        .join("\n");
      base.systemPromptPreview = s || null;
      if (s) {
        pushMessage(base.messages, { role: "system", kind: "system", preview: s });
      }
    }
    const tools = Array.isArray(body.tools) ? body.tools : [];
    for (const t of tools) {
      if (t && typeof t === "object") {
        const name = asString((t as Record<string, unknown>).name);
        if (name) {
          base.tools.push(name);
        }
      }
    }
    const messages = Array.isArray(body.messages) ? body.messages : [];
    for (const m of messages) {
      if (!m || typeof m !== "object") {
        continue;
      }
      const mm = m as Record<string, unknown>;
      const role = asString(mm.role) || "unknown";
      const parsed = flattenAnthropicContent(mm.content, role, "request", base.tools, base.toolCalls, base.messages);
      pushMessage(base.messages, { role, kind: "text", preview: parsed.text });
    }
  } else if (apiFormat === "openai") {
    const tools = Array.isArray(body.tools) ? body.tools : [];
    for (const t of tools) {
      if (t && typeof t === "object") {
        const fn = (t as Record<string, unknown>).function;
        if (fn && typeof fn === "object") {
          const name = asString((fn as Record<string, unknown>).name);
          if (name) {
            base.tools.push(name);
          }
        }
      }
    }
    const input = Array.isArray(body.input) ? body.input : [];
    if (input.length > 0) {
      for (const item of input) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const obj = item as Record<string, unknown>;
        const role = asString(obj.role) || "user";
        const content = obj.content;
        if (typeof content === "string") {
          pushMessage(base.messages, { role, kind: role === "system" ? "system" : "text", preview: content });
        } else if (Array.isArray(content)) {
          const textParts: string[] = [];
          for (const c of content) {
            if (!c || typeof c !== "object") {
              continue;
            }
            const cc = c as Record<string, unknown>;
            const t = asString(cc.type);
            if (t.includes("text")) {
              const text = extractTextFromOpenAiContentPart(cc);
              if (text) {
                textParts.push(text);
              }
              continue;
            }
            if (t === "tool_call" || t === "function_call" || t === "tool_use") {
              const fn = cc.function && typeof cc.function === "object" ? (cc.function as Record<string, unknown>) : null;
              const name = asString(cc.name || cc.function_name || fn?.name) || "unknown_tool";
              const id = asString(cc.call_id || cc.id || cc.tool_call_id) || null;
              const argsPreview = previewFromUnknown(cc.arguments ?? cc.input ?? cc.args ?? fn?.arguments ?? null, 1600) || null;
              pushToolCall(base.toolCalls, {
                source: "request",
                name,
                id,
                argumentsPreview: argsPreview,
                resultPreview: null
              });
              base.tools.push(name);
              pushMessage(base.messages, {
                role: role || "assistant",
                kind: "tool_call",
                toolName: name,
                toolCallId: id,
                preview: `${name}(${argsPreview ?? ""})`
              });
              continue;
            }
            if (t === "tool_result" || t === "function_call_output" || t === "tool_output") {
              const id = asString(cc.call_id || cc.tool_call_id || cc.id) || null;
              const result = previewFromUnknown(cc.output ?? cc.result ?? cc.content ?? null, 1600);
              pushMessage(base.messages, {
                role: "tool",
                kind: "tool_result",
                toolCallId: id,
                preview: result
              });
              continue;
            }
            const fallback = previewFromUnknown(cc, 600);
            if (fallback) {
              textParts.push(fallback);
            }
          }
          pushMessage(base.messages, { role, kind: role === "system" ? "system" : "text", preview: textParts.join("\n") });
        }
        if (role === "tool") {
          const id = asString(obj.tool_call_id || obj.call_id || obj.id) || null;
          const result = previewFromUnknown(obj.output ?? obj.content ?? obj.result ?? null, 1600);
          pushMessage(base.messages, { role: "tool", kind: "tool_result", toolCallId: id, preview: result });
        }
      }
    } else {
      const messages = Array.isArray(body.messages) ? body.messages : [];
      for (const m of messages) {
        if (!m || typeof m !== "object") {
          continue;
        }
        const mm = m as Record<string, unknown>;
        const role = asString(mm.role) || "unknown";
        const content = mm.content;
        pushMessage(base.messages, {
          role,
          kind: role === "system" ? "system" : "text",
          preview: typeof content === "string" ? content : previewFromUnknown(content)
        });
        const tcs = Array.isArray(mm.tool_calls) ? mm.tool_calls : [];
        for (const tc of tcs) {
          if (!tc || typeof tc !== "object") {
            continue;
          }
          const tt = tc as Record<string, unknown>;
          const fn = tt.function && typeof tt.function === "object" ? (tt.function as Record<string, unknown>) : null;
          const name = asString(fn?.name || tt.name) || "unknown_tool";
          const id = asString(tt.id || tt.call_id) || null;
          const argsPreview = previewFromUnknown(fn?.arguments ?? tt.arguments ?? null, 1600) || null;
          pushToolCall(base.toolCalls, {
            source: "request",
            name,
            id,
            argumentsPreview: argsPreview,
            resultPreview: null
          });
          base.tools.push(name);
          pushMessage(base.messages, {
            role: "assistant",
            kind: "tool_call",
            toolName: name,
            toolCallId: id,
            preview: `${name}(${argsPreview ?? ""})`
          });
        }
        if (role === "tool") {
          const id = asString(mm.tool_call_id || mm.call_id || mm.id) || null;
          const result = previewFromUnknown(content, 1600);
          pushMessage(base.messages, { role: "tool", kind: "tool_result", toolCallId: id, preview: result });
        }
      }
    }
    if (!base.systemPromptPreview && typeof body.instructions === "string") {
      base.systemPromptPreview = body.instructions;
      pushMessage(base.messages, { role: "system", kind: "system", preview: body.instructions });
    }
  }

  base.tools = Array.from(new Set([...base.tools, ...base.toolCalls.map((x) => x.name).filter(Boolean)]));
  return base;
}

function summarizeSseResponse(rawBody: Buffer): {
  responsePreview: string | null;
  finishReason: string | null;
  responseMessages: MessageSummary[];
  toolCalls: ToolCallSummary[];
} {
  const text = rawBody.toString("utf8");
  const lines = text.split(/\r?\n/);
  const parts: string[] = [];
  let finishReason: string | null = null;
  const responseMessages: MessageSummary[] = [];
  const toolCalls: ToolCallSummary[] = [];
  const openAiArgsByCall = new Map<string, { name: string; args: string }>();
  const openAiArgsByIndex = new Map<number, { id: string | null; name: string; args: string }>();
  const anthropicToolByBlock = new Map<number, { id: string | null; name: string; argsChunks: string[] }>();

  for (const line of lines) {
    if (!line.startsWith("data:")) {
      continue;
    }
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") {
      continue;
    }
    try {
      const obj = JSON.parse(data) as Record<string, unknown>;
      const type = asString(obj.type);
      const delta = asString(obj.delta);
      if (delta) {
        parts.push(delta);
      }
      const deltaObj = obj.delta;
      if (deltaObj && typeof deltaObj === "object") {
        const dText = asString((deltaObj as Record<string, unknown>).text);
        if (dText) {
          parts.push(dText);
        }
      }
      const contentBlock = obj.content_block;
      if (contentBlock && typeof contentBlock === "object") {
        const cb = contentBlock as Record<string, unknown>;
        const cbText = asString(cb.text);
        if (cbText) {
          parts.push(cbText);
        }
        const cbType = asString(cb.type);
        if (cbType === "tool_use") {
          const name = asString(cb.name) || "unknown_tool";
          const id = asString(cb.id) || null;
          const argsPreview = previewFromUnknown(cb.input ?? cb.arguments ?? null, 1600) || null;
          pushToolCall(toolCalls, {
            source: "stream",
            name,
            id,
            argumentsPreview: argsPreview,
            resultPreview: null
          });
          pushMessage(responseMessages, {
            role: "assistant",
            kind: "tool_call",
            toolName: name,
            toolCallId: id,
            preview: `${name}(${argsPreview ?? ""})`
          });
        }
      }
      if (type === "content_block_start" && obj.content_block && typeof obj.content_block === "object") {
        const cb = obj.content_block as Record<string, unknown>;
        if (asString(cb.type) === "tool_use") {
          const blockIndex = Number(obj.index);
          if (Number.isFinite(blockIndex)) {
            anthropicToolByBlock.set(blockIndex, {
              id: asString(cb.id) || null,
              name: asString(cb.name) || "unknown_tool",
              argsChunks: []
            });
          }
        }
      }
      if (type === "content_block_delta") {
        const blockIndex = Number(obj.index);
        const delta = obj.delta && typeof obj.delta === "object" ? (obj.delta as Record<string, unknown>) : null;
        if (Number.isFinite(blockIndex) && delta && asString(delta.type) === "input_json_delta") {
          const part = asString(delta.partial_json);
          if (part && anthropicToolByBlock.has(blockIndex)) {
            anthropicToolByBlock.get(blockIndex)!.argsChunks.push(part);
          }
        }
      }
      if (type === "content_block_stop") {
        const blockIndex = Number(obj.index);
        if (Number.isFinite(blockIndex) && anthropicToolByBlock.has(blockIndex)) {
          const entry = anthropicToolByBlock.get(blockIndex)!;
          const argsText = entry.argsChunks.join("");
          const argsPreview = normalizePreviewText(argsText || "{}", 1600);
          pushToolCall(toolCalls, {
            source: "stream",
            name: entry.name,
            id: entry.id,
            argumentsPreview: argsPreview,
            resultPreview: null
          });
          pushMessage(responseMessages, {
            role: "assistant",
            kind: "tool_call",
            toolName: entry.name,
            toolCallId: entry.id,
            preview: `${entry.name}(${argsPreview})`
          });
          anthropicToolByBlock.delete(blockIndex);
        }
      }
      if (type.includes("stop") || type.includes("end")) {
        finishReason = type;
      }
      const fr = asString(obj.stop_reason ?? obj.finish_reason);
      if (fr) {
        finishReason = fr;
      }
      const choices = Array.isArray(obj.choices) ? obj.choices : [];
      if (choices.length > 0) {
        const c0 = choices[0];
        if (c0 && typeof c0 === "object") {
          const finish = asString((c0 as Record<string, unknown>).finish_reason);
          if (finish) {
            finishReason = finish;
          }
          const deltaObj = (c0 as Record<string, unknown>).delta;
          if (deltaObj && typeof deltaObj === "object") {
            const dd = deltaObj as Record<string, unknown>;
            const d = asString(dd.content);
            if (d) {
              parts.push(d);
            }
            const tcList = Array.isArray(dd.tool_calls) ? dd.tool_calls : [];
            for (const tc of tcList) {
              if (!tc || typeof tc !== "object") {
                continue;
              }
              const tt = tc as Record<string, unknown>;
              const fn = tt.function && typeof tt.function === "object" ? (tt.function as Record<string, unknown>) : null;
              const name = asString(fn?.name || tt.name) || "unknown_tool";
              const id = asString(tt.id || tt.call_id) || null;
              const idx = Number(tt.index);
              const argChunk = asString(fn?.arguments ?? tt.arguments);
              let argsPreview = previewFromUnknown(fn?.arguments ?? tt.arguments ?? null, 1600) || null;
              if (Number.isFinite(idx)) {
                const curr = openAiArgsByIndex.get(idx) ?? { id: id ?? null, name, args: "" };
                curr.id = curr.id ?? id;
                curr.name = curr.name || name;
                if (argChunk) {
                  curr.args += argChunk;
                }
                openAiArgsByIndex.set(idx, curr);
                if (curr.id) {
                  openAiArgsByCall.set(curr.id, { name: curr.name, args: curr.args });
                }
                argsPreview = normalizePreviewText(curr.args || argsPreview || "", 1600) || argsPreview;
              } else if (id) {
                const curr = openAiArgsByCall.get(id) ?? { name, args: "" };
                if (argChunk) {
                  curr.args += argChunk;
                }
                curr.name = curr.name || name;
                openAiArgsByCall.set(id, curr);
                argsPreview = normalizePreviewText(curr.args || argsPreview || "", 1600) || argsPreview;
              }
            }
          }
        }
      }
      const item = obj.item;
      if (item && typeof item === "object") {
        const ii = item as Record<string, unknown>;
        const t = asString(ii.type);
        if (t === "function_call") {
          const name = asString(ii.name) || "unknown_tool";
          const id = asString(ii.call_id || ii.id) || null;
          const argsRaw = asString(ii.arguments ?? ii.input);
          const knownArgs = id ? (openAiArgsByCall.get(id)?.args || "") : "";
          const argsPreview = normalizePreviewText(knownArgs || argsRaw || previewFromUnknown(ii.arguments ?? ii.input ?? null, 1600), 1600) || null;
          pushToolCall(toolCalls, {
            source: "stream",
            name,
            id,
            argumentsPreview: argsPreview,
            resultPreview: null
          });
          pushMessage(responseMessages, {
            role: "assistant",
            kind: "tool_call",
            toolName: name,
            toolCallId: id,
            preview: `${name}(${argsPreview ?? ""})`
          });
        } else if (t === "function_call_output") {
          const id = asString(ii.call_id || ii.id) || null;
          const resultPreview = previewFromUnknown(ii.output ?? ii.result ?? ii.content ?? null, 1600) || null;
          pushMessage(responseMessages, {
            role: "tool",
            kind: "tool_result",
            toolCallId: id,
            preview: resultPreview ?? "(empty tool result)"
          });
        } else if (t === "message") {
          const role = asString(ii.role) || "assistant";
          const content = Array.isArray(ii.content) ? ii.content : [];
          const textJoined = content
            .map((c) => (c && typeof c === "object" ? asString((c as Record<string, unknown>).text) : ""))
            .filter(Boolean)
            .join("\n");
          if (textJoined) {
            pushMessage(responseMessages, { role, kind: role === "system" ? "system" : "text", preview: textJoined });
          }
        }
      }
      const completion = asString(obj.completion);
      if (completion) {
        parts.push(completion);
      }
    } catch {
      continue;
    }
  }
  const merged = parts.join("");
  if (merged) {
    pushMessage(responseMessages, { role: "assistant", kind: "text", preview: merged });
  }
  for (const [id, tool] of openAiArgsByCall.entries()) {
    const argsPreview = normalizePreviewText(tool.args || "{}", 1600);
    pushToolCall(toolCalls, {
      source: "stream",
      name: tool.name || "unknown_tool",
      id,
      argumentsPreview: argsPreview,
      resultPreview: null
    });
    pushMessage(responseMessages, {
      role: "assistant",
      kind: "tool_call",
      toolName: tool.name || "unknown_tool",
      toolCallId: id,
      preview: `${tool.name || "unknown_tool"}(${argsPreview})`
    });
  }
  return { responsePreview: merged || null, finishReason, responseMessages, toolCalls };
}

function summarizeResponse(
  apiFormat: "anthropic" | "openai" | "unknown",
  jsonBody: unknown,
  rawBody: Buffer,
  contentType?: string
): Pick<LogRecord, "responsePreview" | "usage" | "finishReason" | "responseMessages" | "toolCalls"> {
  if ((contentType ?? "").toLowerCase().includes("text/event-stream")) {
    const sse = summarizeSseResponse(rawBody);
    return {
      responsePreview: sse.responsePreview,
      usage: null,
      finishReason: sse.finishReason,
      responseMessages: sse.responseMessages,
      toolCalls: sse.toolCalls
    };
  }

  if (!jsonBody || typeof jsonBody !== "object") {
    return { responsePreview: null, usage: null, finishReason: null, responseMessages: [], toolCalls: [] };
  }
  const body = jsonBody as Record<string, unknown>;
  const directError = asString(body.error) || asString((body.error as Record<string, unknown> | undefined)?.message);
  const responseMessages: MessageSummary[] = [];
  const toolCalls: ToolCallSummary[] = [];

  if (apiFormat === "anthropic") {
    const content = flattenAnthropicContent(body.content, "assistant", "response", [], toolCalls, responseMessages).text;
    const finishReason = asString(body.stop_reason) || null;
    if (content) {
      pushMessage(responseMessages, { role: "assistant", kind: "text", preview: content });
    }
    return {
      responsePreview: content ? content : directError ? directError : null,
      usage: body.usage ?? null,
      finishReason,
      responseMessages,
      toolCalls
    };
  }

  if (apiFormat === "openai") {
    if (Array.isArray(body.output)) {
      const textParts: string[] = [];
      for (const o of body.output) {
        if (!o || typeof o !== "object") {
          continue;
        }
        const oo = o as Record<string, unknown>;
        const t = asString(oo.type);
        if (t === "message") {
          const role = asString(oo.role) || "assistant";
          const content = Array.isArray(oo.content) ? oo.content : [];
          const parts: string[] = [];
          for (const c of content) {
            if (!c || typeof c !== "object") {
              continue;
            }
            const text = extractTextFromOpenAiContentPart(c as Record<string, unknown>);
            if (text) {
              parts.push(text);
            }
          }
          const text = parts.join("\n");
          if (text) {
            textParts.push(text);
            pushMessage(responseMessages, { role, kind: role === "system" ? "system" : "text", preview: text });
          }
          continue;
        }
        if (t === "function_call") {
          const name = asString(oo.name) || "unknown_tool";
          const id = asString(oo.call_id || oo.id) || null;
          const argsPreview = previewFromUnknown(oo.arguments ?? oo.input ?? null, 1600) || null;
          pushToolCall(toolCalls, {
            source: "response",
            name,
            id,
            argumentsPreview: argsPreview,
            resultPreview: null
          });
          pushMessage(responseMessages, {
            role: "assistant",
            kind: "tool_call",
            toolName: name,
            toolCallId: id,
            preview: `${name}(${argsPreview ?? ""})`
          });
          continue;
        }
        if (t === "function_call_output") {
          const id = asString(oo.call_id || oo.id) || null;
          const resultPreview = previewFromUnknown(oo.output ?? oo.result ?? oo.content ?? null, 1600) || null;
          pushMessage(responseMessages, {
            role: "tool",
            kind: "tool_result",
            toolCallId: id,
            preview: resultPreview ?? "(empty tool result)"
          });
          continue;
        }
      }
      const text = textParts.join("\n");
      return {
        responsePreview: text ? text : null,
        usage: body.usage ?? null,
        finishReason: asString(body.finish_reason) || null,
        responseMessages,
        toolCalls
      };
    }
    if (Array.isArray(body.choices) && body.choices.length > 0) {
      const c0 = body.choices[0] as Record<string, unknown>;
      const message = c0?.message as Record<string, unknown> | undefined;
      let content = "";
      if (message) {
        if (typeof message.content === "string") {
          content = message.content;
        } else if (Array.isArray(message.content)) {
          content = message.content
            .map((part) => (part && typeof part === "object" ? extractTextFromOpenAiContentPart(part as Record<string, unknown>) : ""))
            .filter(Boolean)
            .join("\n");
        } else if (message.content && typeof message.content === "object") {
          content = previewFromUnknown(message.content, 2400);
        }
      }
      if (content) {
        pushMessage(responseMessages, { role: "assistant", kind: "text", preview: content });
      }
      const tcList = Array.isArray(message?.tool_calls) ? (message?.tool_calls as unknown[]) : [];
      for (const tc of tcList) {
        if (!tc || typeof tc !== "object") {
          continue;
        }
        const tt = tc as Record<string, unknown>;
        const fn = tt.function && typeof tt.function === "object" ? (tt.function as Record<string, unknown>) : null;
        const name = asString(fn?.name || tt.name) || "unknown_tool";
        const id = asString(tt.id || tt.call_id) || null;
        const argsPreview = previewFromUnknown(fn?.arguments ?? tt.arguments ?? null, 1600) || null;
        pushToolCall(toolCalls, {
          source: "response",
          name,
          id,
          argumentsPreview: argsPreview,
          resultPreview: null
        });
        pushMessage(responseMessages, {
          role: "assistant",
          kind: "tool_call",
          toolName: name,
          toolCallId: id,
          preview: `${name}(${argsPreview ?? ""})`
        });
      }
      return {
        responsePreview: content || null,
        usage: body.usage ?? null,
        finishReason: asString(c0.finish_reason) || null,
        responseMessages,
        toolCalls
      };
    }
  }

  return {
    responsePreview: directError ? directError : null,
    usage: body.usage ?? null,
    finishReason: null,
    responseMessages,
    toolCalls
  };
}

export class LoggerService {
  private readonly config: LoggingConfig;
  private writeChain: Promise<void> = Promise.resolve();
  private readonly requestSessionMap = new Map<string, string | null>();

  public constructor(config: LoggingConfig) {
    this.config = config;
  }

  public logRequest(payload: RequestLogPayload): void {
    this.enqueue(async () => {
      const parsed = parseJsonIfPossible(payload.rawBody, payload.contentType);
      const apiFormat = detectApiFormat(payload.path, payload.headers);
      const summary = summarizeRequest(apiFormat, parsed.jsonBody);
      const sessionId = getSessionId(payload.headers);
      this.requestSessionMap.set(payload.requestId, sessionId);
      const record: LogRecord = {
        type: "request",
        ts: payload.ts,
        requestId: payload.requestId,
        sessionId,
        method: payload.method,
        path: payload.path,
        provider: payload.provider,
        apiFormat,
        model: summary.model,
        stream: summary.stream,
        systemPromptPreview: summary.systemPromptPreview,
        messages: summary.messages,
        tools: summary.tools,
        parseError: parsed.parseError
      };
      await this.appendRecord(record);
      await this.appendArchiveRecord(record, payload.rawBody, payload.contentType);
    });
  }

  public logResponse(payload: ResponseLogPayload): void {
    this.enqueue(async () => {
      const decodedBody = decodeResponseBody(payload.rawBody, payload.headers);
      const parsed = parseJsonIfPossible(decodedBody, payload.contentType);
      const apiFormat = detectApiFormat(payload.path, payload.headers);
      const summary = summarizeResponse(apiFormat, parsed.jsonBody, decodedBody, payload.contentType);
      const sessionId = getSessionId(payload.headers) ?? this.requestSessionMap.get(payload.requestId) ?? null;
      const record: LogRecord = {
        type: "response",
        ts: payload.ts,
        requestId: payload.requestId,
        sessionId,
        method: payload.method,
        path: payload.path,
        provider: payload.provider,
        apiFormat,
        model: null,
        stream: null,
        responsePreview: summary.responsePreview,
        responseMessages: summary.responseMessages,
        usage: summary.usage,
        finishReason: summary.finishReason,
        statusCode: payload.statusCode,
        parseError: parsed.parseError,
        truncated: payload.truncated
      };
      await this.appendRecord(record);
      await this.appendArchiveRecord(record, decodedBody, payload.contentType);
      this.requestSessionMap.delete(payload.requestId);
    });
  }

  private enqueue(task: () => Promise<void>): void {
    const chained = async (): Promise<void> => {
      await task();
    };

    this.writeChain = this.writeChain.then(chained).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[logger] write failed: ${message}`);
    });
  }

  private async appendRecord(record: LogRecord): Promise<void> {
    await mkdir(dirname(this.config.filePath), { recursive: true });
    await appendFile(this.config.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }

  private async appendArchiveRecord(record: LogRecord, rawBody: Buffer, contentType?: string): Promise<void> {
    const detailPath = archiveRecordFilePath(this.config.filePath, record.sessionId ?? null, record.requestId, record.type);
    const body = toArchivedBody(rawBody, contentType);
    const isSse = (contentType ?? "").toLowerCase().includes("text/event-stream");
    const payload: ArchivedDetailRecord = {
      schemaVersion: 1,
      capturedAt: record.ts,
      requestId: record.requestId,
      sessionId: record.sessionId ?? null,
      type: record.type,
      method: record.method,
      path: record.path,
      provider: record.provider,
      apiFormat: record.apiFormat,
      contentType: contentType ?? null,
      statusCode: record.type === "response" ? (record.statusCode ?? undefined) : undefined,
      truncated: record.type === "response" ? Boolean(record.truncated) : undefined,
      isSse,
      body
    };
    if (isSse && body.encoding === "utf8") {
      payload.sse = parseSseForArchive(body.text || "");
    }

    await mkdir(dirname(detailPath), { recursive: true });
    await writeFile(detailPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}
