import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { ApiFormat, archiveRecordFilePath, legacyArchiveByRequestFilePath, legacyArchiveRecordFilePath } from "../logger-service/archive-path";

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

export type LogCleanupScope = "failed" | "all";

export type RequestUsageMetrics = {
  generatedAt: string;
  openai1m: number;
  openai2m: number;
  claudeCode1m: number;
  claudeCode2m: number;
  sampledRequestRecords: number;
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

function matchesApiFormat(value: string | undefined, filter: ApiFormat | "all"): boolean {
  if (filter === "all") {
    return true;
  }
  return value === filter;
}

function formatLogFilePath(filePath: string, apiFormat: ApiFormat): string {
  const parsed = parse(filePath);
  const ext = parsed.ext || ".jsonl";
  return join(parsed.dir, `${parsed.name}.${apiFormat}${ext}`);
}

function getLogFiles(logPath: string): string[] {
  return [
    logPath,
    formatLogFilePath(logPath, "openai"),
    formatLogFilePath(logPath, "anthropic"),
    formatLogFilePath(logPath, "unknown")
  ];
}

function getDetailSearchFiles(logPath: string, apiFormat: ApiFormat | "all"): string[] {
  if (apiFormat === "all") {
    return [
      formatLogFilePath(logPath, "openai"),
      formatLogFilePath(logPath, "anthropic"),
      formatLogFilePath(logPath, "unknown"),
      logPath
    ];
  }
  return [formatLogFilePath(logPath, apiFormat), logPath];
}

function shouldIncludeRecord(record: RawLogRecord, apiFormat: ApiFormat | "all"): boolean {
  if (!record || !record.requestId) {
    return false;
  }
  return matchesApiFormat(record.apiFormat, apiFormat);
}

function classifyRequestKind(record: RawLogRecord): "openai" | "claudecode" | "" {
  const format = String(record.apiFormat || "").toLowerCase();
  if (format === "openai") {
    return "openai";
  }
  if (format === "anthropic") {
    return "claudecode";
  }
  const path = String(record.path || "").toLowerCase();
  const model = String(record.model || "").toLowerCase();
  if (path.includes("/responses") || path.includes("/chat/completions")) {
    return "openai";
  }
  if (path.includes("/messages") || model.includes("claude")) {
    return "claudecode";
  }
  return "";
}

export async function loadRequestUsageMetrics(logPath: string): Promise<RequestUsageMetrics> {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  const twoMinuteAgo = now - 120_000;
  const files = getLogFiles(logPath);
  const contents = await Promise.all(files.map(async (file) => {
    try {
      return await readFile(file, "utf8");
    } catch {
      return "";
    }
  }));
  const merged = contents.filter(Boolean).join("\n");
  const lines = takeTail(merged.split(/\r?\n/).filter(Boolean), 12_000);
  const seenRequestIds = new Set<string>();
  let sampledRequestRecords = 0;
  let openai1m = 0;
  let openai2m = 0;
  let claudeCode1m = 0;
  let claudeCode2m = 0;

  for (const line of lines) {
    const record = parseRecord(line);
    if (!record || record.type !== "request" || !record.requestId) {
      continue;
    }
    if (seenRequestIds.has(record.requestId)) {
      continue;
    }
    seenRequestIds.add(record.requestId);
    sampledRequestRecords += 1;
    const ts = toMs(record.ts || null);
    if (ts == null || ts < twoMinuteAgo) {
      continue;
    }
    const kind = classifyRequestKind(record);
    if (!kind) {
      continue;
    }
    if (kind === "openai") {
      openai2m += 1;
      if (ts >= oneMinuteAgo) {
        openai1m += 1;
      }
      continue;
    }
    claudeCode2m += 1;
    if (ts >= oneMinuteAgo) {
      claudeCode1m += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    openai1m,
    openai2m,
    claudeCode1m,
    claudeCode2m,
    sampledRequestRecords
  };
}

export async function loadPairedLogs(logPath: string, limit = 80, apiFormat: ApiFormat | "all" = "all"): Promise<PairedLogItem[]> {
  let content = "";
  if (apiFormat === "all") {
    const paths = [
      formatLogFilePath(logPath, "openai"),
      formatLogFilePath(logPath, "anthropic"),
      formatLogFilePath(logPath, "unknown")
    ];
    const contents = await Promise.all(paths.map(async (p) => {
      try {
        return await readFile(p, "utf8");
      } catch {
        return "";
      }
    }));
    content = contents.filter(Boolean).join("\n");
  } else {
    try {
      content = await readFile(formatLogFilePath(logPath, apiFormat), "utf8");
    } catch {
      content = "";
    }
  }

  if (!content && apiFormat === "all") {
    try {
      content = await readFile(logPath, "utf8");
    } catch {
      return [];
    }
  } else if (!content) {
    try {
      content = await readFile(logPath, "utf8");
    } catch {
      return [];
    }
  }

  const lines = takeTail(content.split(/\r?\n/).filter(Boolean), Math.max(limit * 8, 500));
  const byRequestId = new Map<string, PairedLogItem>();

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const r = parseRecord(line);
    if (!r || !r.requestId) {
      continue;
    }
    if (!matchesApiFormat(r.apiFormat, apiFormat)) {
      continue;
    }
    const isReq = r.type === "request";
    let item = byRequestId.get(r.requestId);
    if (!item) {
      item = {
        logId: r.requestId,
        requestId: r.requestId,
        sessionId: r.sessionId ?? null,
        startedAt: null,
        endedAt: null,
        durationMs: null,
        method: null,
        path: null,
        provider: null,
        apiFormat: null,
        model: null,
        statusCode: null,
        finishReason: null,
        request: null,
        response: null
      };
      byRequestId.set(r.requestId, item);
    }

    if (!item.sessionId && r.sessionId) {
      item.sessionId = r.sessionId;
    }
    if (!item.method && r.method) {
      item.method = r.method;
    }
    if (!item.path && r.path) {
      item.path = r.path;
    }
    if (!item.provider && r.provider) {
      item.provider = r.provider;
    }
    if (!item.apiFormat && r.apiFormat) {
      item.apiFormat = r.apiFormat;
    }
    if (!item.model && r.model) {
      item.model = r.model;
    }

    if (isReq) {
      const startedMs = toMs(item.startedAt);
      const nextStartedMs = toMs(r.ts ?? null);
      if (startedMs === null || (nextStartedMs !== null && nextStartedMs < startedMs)) {
        item.startedAt = r.ts ?? null;
      }
      item.request = {
        stream: r.stream ?? null,
        systemPromptPreview: r.systemPromptPreview ?? null,
        messages: Array.isArray(r.messages) ? r.messages : [],
        tools: Array.isArray(r.tools) ? r.tools : [],
        parseError: r.parseError ?? null
      };
      continue;
    }

    const endedMs = toMs(item.endedAt);
    const nextEndedMs = toMs(r.ts ?? null);
    if (endedMs === null || (nextEndedMs !== null && nextEndedMs > endedMs)) {
      item.endedAt = r.ts ?? null;
      item.statusCode = typeof r.statusCode === "number" ? r.statusCode : null;
      item.finishReason = r.finishReason ?? null;
      item.response = {
        responsePreview: r.responsePreview ?? null,
        messages: Array.isArray(r.responseMessages) ? r.responseMessages : [],
        usage: r.usage ?? null,
        parseError: r.parseError ?? null,
        truncated: Boolean(r.truncated)
      };
    }
  }

  const items = Array.from(byRequestId.values())
    .map((item) => {
      const startedMs = toMs(item.startedAt);
      const endedMs = toMs(item.endedAt);
      const durationMs =
        startedMs !== null && endedMs !== null && endedMs >= startedMs
          ? endedMs - startedMs
          : null;
      return { ...item, durationMs };
    });

  const ordered = items.sort((a, b) => {
    const am = toMs(a.startedAt ?? a.endedAt ?? null) ?? 0;
    const bm = toMs(b.startedAt ?? b.endedAt ?? null) ?? 0;
    return bm - am;
  });

  return takeTail(ordered.reverse(), limit).reverse();
}

type CleanupResult = {
  removedRequests: number;
  removedRecords: number;
};

export async function cleanupArchivedLogs(
  logPath: string,
  scope: LogCleanupScope,
  apiFormat: ApiFormat | "all" = "all"
): Promise<CleanupResult> {
  const files = getLogFiles(logPath);
  const parsedByFile = new Map<string, RawLogRecord[]>();
  const linesByFile = new Map<string, string[]>();
  const requestIds = new Set<string>();
  const sessionsByRequest = new Map<string, Set<string | null>>();

  for (const file of files) {
    let content = "";
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/).filter(Boolean);
    linesByFile.set(file, lines);
    const parsed = lines.map(parseRecord).filter((record): record is RawLogRecord => Boolean(record));
    parsedByFile.set(file, parsed);
  }

  if (scope === "all") {
    for (const records of parsedByFile.values()) {
      for (const record of records) {
        if (shouldIncludeRecord(record, apiFormat)) {
          requestIds.add(record.requestId);
        }
      }
    }
  } else {
    for (const records of parsedByFile.values()) {
      for (const record of records) {
        if (!shouldIncludeRecord(record, apiFormat)) {
          continue;
        }
        if (record.type === "response" && typeof record.statusCode === "number" && record.statusCode >= 400) {
          requestIds.add(record.requestId);
        }
      }
    }
  }

  if (requestIds.size === 0) {
    return { removedRequests: 0, removedRecords: 0 };
  }

  let removedRecords = 0;
  for (const [file, lines] of linesByFile.entries()) {
    const kept: string[] = [];
    for (const line of lines) {
      const record = parseRecord(line);
      if (record && requestIds.has(record.requestId)) {
        removedRecords += 1;
        if (!sessionsByRequest.has(record.requestId)) {
          sessionsByRequest.set(record.requestId, new Set<string | null>());
        }
        sessionsByRequest.get(record.requestId)?.add(record.sessionId ?? null);
        continue;
      }
      kept.push(line);
    }
    const next = kept.length ? `${kept.join("\n")}\n` : "";
    await writeFile(file, next, "utf8");
  }

  const archiveFormats: ApiFormat[] = apiFormat === "all" ? ["openai", "anthropic", "unknown"] : [apiFormat];
  for (const requestId of requestIds) {
    for (const format of archiveFormats) {
      const requestArchiveDir = dirname(archiveRecordFilePath(logPath, null, requestId, "request", format));
      await rm(requestArchiveDir, { recursive: true, force: true });
    }

    const legacyDir = dirname(legacyArchiveByRequestFilePath(logPath, requestId, "request"));
    await rm(legacyDir, { recursive: true, force: true });

    const sessions = sessionsByRequest.get(requestId) ?? new Set<string | null>();
    sessions.add(null);
    for (const sessionId of sessions) {
      const requestPath = legacyArchiveRecordFilePath(logPath, sessionId, requestId, "request");
      const responsePath = legacyArchiveRecordFilePath(logPath, sessionId, requestId, "response");
      await rm(requestPath, { force: true });
      await rm(responsePath, { force: true });
    }
  }

  return {
    removedRequests: requestIds.size,
    removedRecords
  };
}

export async function loadArchivedLogDetail(
  logPath: string,
  requestId: string,
  apiFormat: ApiFormat | "all" = "all",
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

    // New scheme: by apiFormat + requestId.
    if (apiFormat !== "all") {
      const byTypedRequest = await tryRead(archiveRecordFilePath(logPath, null, requestId, type, apiFormat));
      if (byTypedRequest) {
        return byTypedRequest;
      }
    } else {
      const byOpenAi = await tryRead(archiveRecordFilePath(logPath, null, requestId, type, "openai"));
      if (byOpenAi) {
        return byOpenAi;
      }
      const byAnthropic = await tryRead(archiveRecordFilePath(logPath, null, requestId, type, "anthropic"));
      if (byAnthropic) {
        return byAnthropic;
      }
      const byUnknown = await tryRead(archiveRecordFilePath(logPath, null, requestId, type, "unknown"));
      if (byUnknown) {
        return byUnknown;
      }
    }

    // Legacy fallback: requestId-only archive path.
    const byRequest = await tryRead(legacyArchiveByRequestFilePath(logPath, requestId, type));
    if (byRequest) {
      return byRequest;
    }

    // Legacy fallback: session-based path.
    if (sessionId) {
      const hit = await tryRead(legacyArchiveRecordFilePath(logPath, sessionId, requestId, type));
      if (hit) {
        return hit;
      }
    }
    return tryRead(legacyArchiveRecordFilePath(logPath, null, requestId, type));
  };
  const asArchivedFromRecord = (record: RawLogRecord): unknown => {
    const payload =
      record.type === "request"
        ? {
            model: record.model ?? null,
            stream: record.stream ?? null,
            systemPromptPreview: record.systemPromptPreview ?? null,
            messages: Array.isArray(record.messages) ? record.messages : [],
            tools: Array.isArray(record.tools) ? record.tools : [],
            toolCalls: Array.isArray(record.toolCalls) ? record.toolCalls : [],
            parseError: record.parseError ?? null
          }
        : {
            responsePreview: record.responsePreview ?? null,
            responseMessages: Array.isArray(record.responseMessages) ? record.responseMessages : [],
            toolCalls: Array.isArray(record.toolCalls) ? record.toolCalls : [],
            usage: record.usage ?? null,
            finishReason: record.finishReason ?? null,
            parseError: record.parseError ?? null,
            truncated: Boolean(record.truncated)
          };
    const text = JSON.stringify(payload);
    return {
      schemaVersion: 1,
      capturedAt: record.ts,
      requestId: record.requestId,
      sessionId: record.sessionId ?? null,
      type: record.type,
      method: record.method,
      path: record.path,
      provider: record.provider,
      apiFormat: record.apiFormat ?? "unknown",
      contentType: "application/json",
      statusCode: record.type === "response" ? (record.statusCode ?? undefined) : undefined,
      truncated: record.type === "response" ? Boolean(record.truncated) : undefined,
      isSse: false,
      body: {
        encoding: "utf8",
        text,
        byteLength: Buffer.byteLength(text, "utf8")
      },
      source: "jsonl"
    };
  };

  const loadFromLogRecords = async (): Promise<{ request: unknown | null; response: unknown | null }> => {
    let reqRecord: RawLogRecord | null = null;
    let resRecord: RawLogRecord | null = null;
    const files = getDetailSearchFiles(logPath, apiFormat);

    for (const file of files) {
      let content = "";
      try {
        content = await readFile(file, "utf8");
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const rec = parseRecord(line);
        if (!rec || rec.requestId !== requestId) {
          continue;
        }
        if (apiFormat !== "all" && rec.apiFormat !== apiFormat) {
          continue;
        }
        if (rec.type === "request") {
          reqRecord = rec;
        } else if (rec.type === "response") {
          resRecord = rec;
        }
      }
    }

    return {
      request: reqRecord ? asArchivedFromRecord(reqRecord) : null,
      response: resRecord ? asArchivedFromRecord(resRecord) : null
    };
  };

  const [request, response] = await Promise.all([readOne("request"), readOne("response")]);
  if (request || response) {
    return { request, response };
  }
  return loadFromLogRecords();
}
