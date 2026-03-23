import { readFile } from "node:fs/promises";
import { archiveRecordFilePath, legacyArchiveRecordFilePath } from "../logger-service/archive-path";

type RawLogRecord = {
  type: "request" | "response";
  ts: string;
  requestId: string;
  sessionId?: string | null;
  method?: string;
  path?: string;
  provider?: string;
  apiFormat?: string;
  model?: string | null;
  stream?: boolean | null;
  systemPromptPreview?: string | null;
  messages?: Array<{
    role: string;
    preview: string;
    kind?: "text" | "system" | "tool_call" | "tool_result";
    toolName?: string | null;
    toolCallId?: string | null;
  }>;
  tools?: string[];
  toolCalls?: Array<{
    source: "request" | "response" | "stream";
    name: string;
    id: string | null;
    argumentsPreview: string | null;
    resultPreview: string | null;
  }>;
  responsePreview?: string | null;
  responseMessages?: Array<{
    role: string;
    preview: string;
    kind?: "text" | "system" | "tool_call" | "tool_result";
    toolName?: string | null;
    toolCallId?: string | null;
  }>;
  usage?: unknown;
  finishReason?: string | null;
  statusCode?: number;
  parseError?: string | null;
  truncated?: boolean;
};

export type PairedLogItem = {
  logId: string;
  requestId: string;
  sessionId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  method: string | null;
  path: string | null;
  provider: string | null;
  apiFormat: string | null;
  model: string | null;
  statusCode: number | null;
  finishReason: string | null;
  request: {
    stream: boolean | null;
    systemPromptPreview: string | null;
    messages: Array<{
      role: string;
      preview: string;
      kind?: "text" | "system" | "tool_call" | "tool_result";
      toolName?: string | null;
      toolCallId?: string | null;
    }>;
    tools: string[];
    parseError: string | null;
  } | null;
  response: {
    responsePreview: string | null;
    messages: Array<{
      role: string;
      preview: string;
      kind?: "text" | "system" | "tool_call" | "tool_result";
      toolName?: string | null;
      toolCallId?: string | null;
    }>;
    usage: unknown;
    parseError: string | null;
    truncated: boolean;
  } | null;
};

function toMs(ts: string | null): number | null {
  if (!ts) {
    return null;
  }
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : null;
}

function parseRecord(line: string): RawLogRecord | null {
  if (!line.trim()) {
    return null;
  }
  try {
    return JSON.parse(line) as RawLogRecord;
  } catch {
    return null;
  }
}

function takeTail<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) {
    return arr;
  }
  return arr.slice(arr.length - n);
}

export async function loadPairedLogs(logPath: string, limit = 80): Promise<PairedLogItem[]> {
  let content = "";
  try {
    content = await readFile(logPath, "utf8");
  } catch {
    return [];
  }

  const lines = takeTail(content.split(/\r?\n/).filter(Boolean), Math.max(limit * 8, 500));
  const items: PairedLogItem[] = [];

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const r = parseRecord(line);
    if (!r || !r.requestId) {
      continue;
    }
    const isReq = r.type === "request";
    const item: PairedLogItem = {
      logId: `${idx}-${r.type}-${r.requestId}-${r.ts || ""}`,
      requestId: r.requestId,
      sessionId: r.sessionId ?? null,
      startedAt: isReq ? (r.ts ?? null) : null,
      endedAt: isReq ? null : (r.ts ?? null),
      durationMs: null,
      method: r.method ?? null,
      path: r.path ?? null,
      provider: r.provider ?? null,
      apiFormat: r.apiFormat ?? null,
      model: r.model ?? null,
      statusCode: !isReq && typeof r.statusCode === "number" ? r.statusCode : null,
      finishReason: !isReq ? (r.finishReason ?? null) : null,
      request: isReq
        ? {
            stream: r.stream ?? null,
            systemPromptPreview: r.systemPromptPreview ?? null,
            messages: Array.isArray(r.messages) ? r.messages : [],
            tools: Array.isArray(r.tools) ? r.tools : [],
            parseError: r.parseError ?? null
          }
        : null,
      response: isReq
        ? null
        : {
          responsePreview: r.responsePreview ?? null,
          messages: Array.isArray(r.responseMessages) ? r.responseMessages : [],
          usage: r.usage ?? null,
          parseError: r.parseError ?? null,
          truncated: Boolean(r.truncated)
          }
    };
    items.push(item);
  }

  const ordered = items.sort((a, b) => {
    const am = toMs(a.startedAt ?? a.endedAt ?? null) ?? 0;
    const bm = toMs(b.startedAt ?? b.endedAt ?? null) ?? 0;
    return bm - am;
  });

  return takeTail(ordered.reverse(), limit).reverse();
}

export async function loadArchivedLogDetail(
  logPath: string,
  requestId: string,
  sessionId?: string | null
): Promise<{
  request: unknown | null;
  response: unknown | null;
}> {
  const readOne = async (type: "request" | "response"): Promise<unknown | null> => {
    const tryRead = async (p: string): Promise<unknown | null> => {
      try {
        const content = await readFile(p, "utf8");
        return JSON.parse(content) as unknown;
      } catch {
        return null;
      }
    };

    // New scheme: by requestId only.
    const byRequest = await tryRead(archiveRecordFilePath(logPath, null, requestId, type));
    if (byRequest) {
      return byRequest;
    }

    // Legacy fallback: prefer given session for precision, then no-session.
    if (sessionId) {
      const hit = await tryRead(legacyArchiveRecordFilePath(logPath, sessionId, requestId, type));
      if (hit) {
        return hit;
      }
    }
    return tryRead(legacyArchiveRecordFilePath(logPath, null, requestId, type));
  };

  const [request, response] = await Promise.all([readOne("request"), readOne("response")]);
  return { request, response };
}
