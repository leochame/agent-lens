import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { dirname, join } from "node:path";
import { AppConfig } from "../provider/types";
import { resolveRouting } from "../provider/router";
import { LoggerService } from "../../log/service/logger";
import { forwardRequest } from "./forward";
import { newRequestId } from "../request-id";
import { resolveLogFilePath, saveConfig } from "../config/config";
import { cleanupArchivedLogs, loadArchivedLogDetail, loadPairedLogs } from "../../log/archive";
import { ApiFormat } from "../../log/service/archive-path";
import { renderLoopHtml } from "../../frontend/loop/page";
import { LoopScheduler } from "../../loop/engine";
import { CreateLoopTaskInput, UpdateLoopTaskInput } from "../../loop/types";
import { renderRouterHtml } from "../../frontend/router/page";
import { renderLogHtml } from "../../frontend/log/page";
import { renderHomeHtml } from "../../frontend/home/page";

const DEFAULT_ADMIN_BODY_BYTES = 10 * 1024 * 1024;

class PayloadTooLargeError extends Error {
  readonly statusCode = 413;

  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = "PayloadTooLargeError";
  }
}

function collectBody(req: IncomingMessage, maxBytes = 0): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const cleanup = (): void => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
    };

    const onError = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer | string): void => {
      if (settled) {
        return;
      }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (maxBytes > 0 && totalBytes > maxBytes) {
        settled = true;
        cleanup();
        req.resume();
        reject(new PayloadTooLargeError(maxBytes));
        return;
      }
      chunks.push(buffer);
    };

    const onEnd = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}

function writeProxyError(res: ServerResponse, statusCode: number, requestId: string, message: string): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      error: message,
      requestId
    })
  );
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

type RuntimeState = {
  config: AppConfig;
  logFilePath: string;
  logger: LoggerService;
  configPath: string;
  loopScheduler: LoopScheduler;
};

export type StartedServer = {
  close: () => Promise<void>;
  shutdownLoop: () => void;
};

export function parseOptionalLimit(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  const text = String(value).trim();
  if (!text) {
    return fallback;
  }
  const num = Number(text);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, num));
}

export function buildLoopStateSnapshot(
  scheduler: LoopScheduler,
  limits?: { tasks?: unknown; runs?: unknown; liveRuns?: unknown; queue?: unknown }
): {
  tasks: ReturnType<LoopScheduler["listTasks"]>;
  runs: ReturnType<LoopScheduler["listRuns"]>;
  liveRuns: ReturnType<LoopScheduler["listLiveRuns"]>;
  queue: ReturnType<LoopScheduler["listQueue"]>;
  settings: ReturnType<LoopScheduler["getSettings"]>;
} {
  const taskLimit = parseOptionalLimit(limits && limits.tasks, 200, 1, 500);
  const runLimit = parseOptionalLimit(limits && limits.runs, 40, 1, 200);
  const liveLimit = parseOptionalLimit(limits && limits.liveRuns, 20, 1, 100);
  const queueLimit = parseOptionalLimit(limits && limits.queue, 30, 1, 200);
  return {
    tasks: scheduler.listTasks().slice(0, taskLimit),
    runs: scheduler.listRuns(runLimit),
    liveRuns: scheduler.listLiveRuns(liveLimit),
    queue: scheduler.listQueue(queueLimit),
    settings: scheduler.getSettings()
  };
}

function parseApiFormat(value: string | null): ApiFormat | "all" {
  if (value === "openai" || value === "anthropic" || value === "unknown") {
    return value;
  }
  return "all";
}

async function handleAdmin(req: IncomingMessage, res: ServerResponse, state: RuntimeState): Promise<boolean> {
  const reqUrl = req.url ?? "/";
  if (!reqUrl.startsWith("/__admin") && !reqUrl.startsWith("/__router") && !reqUrl.startsWith("/__log")) {
    return false;
  }
  const parsed = new URL(reqUrl, "http://127.0.0.1");

  if (req.method === "GET" && parsed.pathname === "/__router") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(renderRouterHtml(state.config));
    return true;
  }
  if (req.method === "GET" && parsed.pathname === "/__log") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(renderLogHtml("all", state.config));
    return true;
  }
  if (req.method === "GET" && parsed.pathname === "/__log/openai") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(renderLogHtml("openai", state.config));
    return true;
  }
  if (req.method === "GET" && parsed.pathname === "/__log/anthropic") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(renderLogHtml("anthropic", state.config));
    return true;
  }
  if (req.method === "GET" && parsed.pathname === "/__admin") {
    res.writeHead(302, { location: "/__log" });
    res.end();
    return true;
  }
  if (req.method === "GET" && parsed.pathname === "/__admin/openai") {
    res.writeHead(302, { location: "/__log/openai" });
    res.end();
    return true;
  }
  if (req.method === "GET" && parsed.pathname === "/__admin/anthropic") {
    res.writeHead(302, { location: "/__log/anthropic" });
    res.end();
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__admin/api/config") {
    writeJson(res, 200, state.config);
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__admin/api/logs") {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(10, Math.min(300, Number(limitRaw))) : 80;
    const apiFormat = parseApiFormat(parsed.searchParams.get("apiFormat"));
    const items = await loadPairedLogs(state.logFilePath, limit, apiFormat);
    writeJson(res, 200, { items, apiFormat, generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__admin/api/logs/metrics") {
    const item = state.logger.getRequestUsageMetrics();
    writeJson(res, 200, { item, generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && (parsed.pathname === "/__admin/api/openai/logs" || parsed.pathname === "/__admin/api/anthropic/logs")) {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(10, Math.min(300, Number(limitRaw))) : 80;
    const apiFormat: ApiFormat = parsed.pathname.includes("/openai/") ? "openai" : "anthropic";
    const items = await loadPairedLogs(state.logFilePath, limit, apiFormat);
    writeJson(res, 200, { items, generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__admin/api/logs/detail") {
    const requestId = (parsed.searchParams.get("requestId") || "").trim();
    const sessionId = (parsed.searchParams.get("sessionId") || "").trim() || null;
    const apiFormat = parseApiFormat(parsed.searchParams.get("apiFormat"));
    if (!requestId) {
      writeJson(res, 400, { error: "requestId is required" });
      return true;
    }
    const detail = await loadArchivedLogDetail(state.logFilePath, requestId, apiFormat, sessionId);
    writeJson(res, 200, { requestId, sessionId, apiFormat, detail, generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && (parsed.pathname === "/__admin/api/openai/logs/detail" || parsed.pathname === "/__admin/api/anthropic/logs/detail")) {
    const requestId = (parsed.searchParams.get("requestId") || "").trim();
    const sessionId = (parsed.searchParams.get("sessionId") || "").trim() || null;
    const apiFormat: ApiFormat = parsed.pathname.includes("/openai/") ? "openai" : "anthropic";
    if (!requestId) {
      writeJson(res, 400, { error: "requestId is required" });
      return true;
    }
    const detail = await loadArchivedLogDetail(state.logFilePath, requestId, apiFormat, sessionId);
    writeJson(res, 200, { requestId, sessionId, apiFormat, detail, generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__admin/api/logs/stream") {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(10, Math.min(300, Number(limitRaw))) : 80;
    const apiFormat = parseApiFormat(parsed.searchParams.get("apiFormat"));
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });
    res.write("retry: 1500\n\n");

    let lastItemsPayload = "";
    const send = async (): Promise<void> => {
      const items = await loadPairedLogs(state.logFilePath, limit, apiFormat);
      const itemsPayload = JSON.stringify(items);
      if (itemsPayload === lastItemsPayload) {
        return;
      }
      lastItemsPayload = itemsPayload;
      const payload = JSON.stringify({ items, apiFormat, generatedAt: new Date().toISOString() });
      res.write(`event: logs\ndata: ${payload}\n\n`);
    };

    const timer = setInterval(() => {
      void send();
    }, 1500);

    void send();

    req.on("close", () => {
      clearInterval(timer);
      res.end();
    });
    return true;
  }

  if (req.method === "POST" && parsed.pathname === "/__admin/api/logs/cleanup") {
    const apiFormat = parseApiFormat(parsed.searchParams.get("apiFormat"));
    const body = await collectBody(req, DEFAULT_ADMIN_BODY_BYTES);
    let payload: { scope?: "failed" | "all" } = {};
    if (body.length > 0) {
      try {
        payload = JSON.parse(body.toString("utf8")) as { scope?: "failed" | "all" };
      } catch {
        writeJson(res, 400, { error: "Invalid JSON body" });
        return true;
      }
    }
    const scope = payload.scope === "failed" ? "failed" : payload.scope === "all" ? "all" : null;
    if (!scope) {
      writeJson(res, 400, { error: "scope must be 'failed' or 'all'" });
      return true;
    }

    const result = await cleanupArchivedLogs(state.logFilePath, scope, apiFormat);
    writeJson(res, 200, {
      scope,
      apiFormat,
      removedRequests: result.removedRequests,
      removedRecords: result.removedRecords,
      generatedAt: new Date().toISOString()
    });
    return true;
  }

  if (req.method === "PUT" && parsed.pathname === "/__admin/api/config") {
    const body = await collectBody(req, DEFAULT_ADMIN_BODY_BYTES);
    let nextConfig: AppConfig;
    try {
      nextConfig = JSON.parse(body.toString("utf8")) as AppConfig;
    } catch {
      writeJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }

    try {
      await saveConfig(state.configPath, nextConfig);
      state.config = nextConfig;
      state.logFilePath = resolveLogFilePath(state.configPath, state.config.logging.filePath);
      state.logger = new LoggerService({
        ...state.config.logging,
        filePath: state.logFilePath
      });
      writeJson(res, 200, state.config);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  writeJson(res, 404, { error: "Not found" });
  return true;
}

async function handleHome(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const reqUrl = req.url ?? "/";
  const parsed = new URL(reqUrl, "http://127.0.0.1");
  if (req.method !== "GET") {
    return false;
  }
  if (parsed.pathname !== "/__home") {
    return false;
  }
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(renderHomeHtml());
  return true;
}

export function parseTaskId(pathname: string, action: "run" | "resume" | "toggle" | "stop" | "stop-after-round" | null): string | null {
  const suffix = action ? `/${action}` : "";
  const match = pathname.match(new RegExp(`^/__loop/api/tasks/([^/]+)${suffix}$`));
  if (!match || !match[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function handleLoop(req: IncomingMessage, res: ServerResponse, state: RuntimeState): Promise<boolean> {
  const reqUrl = req.url ?? "/";
  if (!reqUrl.startsWith("/__loop")) {
    return false;
  }
  const parsed = new URL(reqUrl, "http://127.0.0.1");

  if (req.method === "GET" && parsed.pathname === "/__loop") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(renderLoopHtml());
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__loop/api/tasks") {
    writeJson(res, 200, { items: state.loopScheduler.listTasks(), generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__loop/api/settings") {
    writeJson(res, 200, { item: state.loopScheduler.getSettings(), generatedAt: new Date().toISOString() });
    return true;
  }

  if ((req.method === "PUT" || req.method === "PATCH") && parsed.pathname === "/__loop/api/settings") {
    const body = await collectBody(req, DEFAULT_ADMIN_BODY_BYTES);
    let payload: { maxConcurrentRuns?: number };
    try {
      payload = JSON.parse(body.toString("utf8")) as { maxConcurrentRuns?: number };
    } catch {
      writeJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    try {
      const item = state.loopScheduler.updateSettings(payload);
      writeJson(res, 200, { item });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  if (req.method === "POST" && parsed.pathname === "/__loop/api/tasks") {
    const body = await collectBody(req, DEFAULT_ADMIN_BODY_BYTES);
    let payload: CreateLoopTaskInput;
    try {
      payload = JSON.parse(body.toString("utf8")) as CreateLoopTaskInput;
    } catch {
      writeJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    try {
      const task = await state.loopScheduler.createTask(payload);
      writeJson(res, 200, { item: task });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  if (req.method === "POST" && parsed.pathname === "/__loop/api/path-check") {
    const body = await collectBody(req, DEFAULT_ADMIN_BODY_BYTES);
    let payload: { path?: string };
    try {
      payload = JSON.parse(body.toString("utf8")) as { path?: string };
    } catch {
      writeJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    const pathValue = String(payload.path ?? "").trim();
    if (!pathValue) {
      writeJson(res, 400, { error: "path is required" });
      return true;
    }
    try {
      const item = await state.loopScheduler.inspectPath(pathValue);
      writeJson(res, 200, { item });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  if (req.method === "POST" && parsed.pathname === "/__loop/api/test-run") {
    const body = await collectBody(req, DEFAULT_ADMIN_BODY_BYTES);
    let payload: CreateLoopTaskInput;
    try {
      payload = JSON.parse(body.toString("utf8")) as CreateLoopTaskInput;
    } catch {
      writeJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    try {
      const run = await state.loopScheduler.testTask(payload);
      writeJson(res, 200, { item: run });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  if (req.method === "GET" && parsed.pathname === "/__loop/api/runs") {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(200, Number(limitRaw))) : 40;
    writeJson(res, 200, { items: state.loopScheduler.listRuns(limit), generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__loop/api/runs/live") {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(100, Number(limitRaw))) : 20;
    writeJson(res, 200, { items: state.loopScheduler.listLiveRuns(limit), generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__loop/api/queue") {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(200, Number(limitRaw))) : 40;
    writeJson(res, 200, { items: state.loopScheduler.listQueue(limit), generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__loop/api/runs/live/stream") {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(100, Number(limitRaw))) : 20;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });
    res.write("retry: 1200\n\n");

    let lastItemsPayload = "";
    const send = (): void => {
      const items = state.loopScheduler.listLiveRuns(limit);
      const itemsPayload = JSON.stringify(items);
      if (itemsPayload === lastItemsPayload) {
        return;
      }
      lastItemsPayload = itemsPayload;
      const body = JSON.stringify({ items, generatedAt: new Date().toISOString() });
      res.write(`event: live-runs\ndata: ${body}\n\n`);
    };

    const timer = setInterval(send, 1000);
    send();

    req.on("close", () => {
      clearInterval(timer);
      res.end();
    });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__loop/api/state") {
    const limits = {
      tasks: parsed.searchParams.get("tasks"),
      runs: parsed.searchParams.get("runs"),
      liveRuns: parsed.searchParams.get("liveRuns"),
      queue: parsed.searchParams.get("queue")
    };
    const item = buildLoopStateSnapshot(state.loopScheduler, limits);
    writeJson(res, 200, { item, generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__loop/api/state/stream") {
    const limits = {
      tasks: parsed.searchParams.get("tasks"),
      runs: parsed.searchParams.get("runs"),
      liveRuns: parsed.searchParams.get("liveRuns"),
      queue: parsed.searchParams.get("queue")
    };
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });
    res.write("retry: 1200\n\n");

    let lastItemPayload = "";
    const send = (): void => {
      const item = buildLoopStateSnapshot(state.loopScheduler, limits);
      const itemPayload = JSON.stringify(item);
      if (itemPayload === lastItemPayload) {
        return;
      }
      lastItemPayload = itemPayload;
      const body = JSON.stringify({ item, generatedAt: new Date().toISOString() });
      res.write(`event: loop-state\ndata: ${body}\n\n`);
    };

    const timer = setInterval(send, 1000);
    send();
    req.on("close", () => {
      clearInterval(timer);
      res.end();
    });
    return true;
  }

  if ((req.method === "PUT" || req.method === "PATCH") && parsed.pathname.startsWith("/__loop/api/tasks/")) {
    const taskId = parseTaskId(parsed.pathname, null);
    if (!taskId) {
      writeJson(res, 404, { error: "Not found" });
      return true;
    }
    const body = await collectBody(req, DEFAULT_ADMIN_BODY_BYTES);
    let payload: UpdateLoopTaskInput;
    try {
      payload = JSON.parse(body.toString("utf8")) as UpdateLoopTaskInput;
    } catch {
      writeJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    try {
      const task = await state.loopScheduler.updateTask(taskId, payload);
      writeJson(res, 200, { item: task });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  if (req.method === "POST" && parsed.pathname.startsWith("/__loop/api/tasks/") && parsed.pathname.endsWith("/run")) {
    const taskId = parseTaskId(parsed.pathname, "run");
    if (!taskId) {
      writeJson(res, 404, { error: "Not found" });
      return true;
    }
    if (!state.loopScheduler.hasTask(taskId)) {
      writeJson(res, 404, { error: "task not found" });
      return true;
    }
    const shouldWait = (() => {
      const raw = String(parsed.searchParams.get("wait") || "").trim().toLowerCase();
      return raw === "1" || raw === "true" || raw === "yes";
    })();
    try {
      if (shouldWait) {
        const run = await state.loopScheduler.runNow(taskId);
        writeJson(res, 200, { item: run });
        return true;
      }
      void state.loopScheduler.runNow(taskId).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[loop] async run failed taskId=${taskId} error=${message}`);
      });
      writeJson(res, 202, { ok: true, accepted: true, async: true });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message === "task not found" ? 404 : 400;
      writeJson(res, status, { error: message });
      return true;
    }
  }

  if (req.method === "POST" && parsed.pathname.startsWith("/__loop/api/tasks/") && parsed.pathname.endsWith("/resume")) {
    const taskId = parseTaskId(parsed.pathname, "resume");
    if (!taskId) {
      writeJson(res, 404, { error: "Not found" });
      return true;
    }
    let stepIndex: number | null | undefined = undefined;
    if ((req.headers["content-length"] && req.headers["content-length"] !== "0")
      || String(req.headers["content-type"] || "").includes("application/json")) {
      const body = await collectBody(req, DEFAULT_ADMIN_BODY_BYTES);
      if (body.length > 0) {
        try {
          const payload = JSON.parse(body.toString("utf8")) as { stepIndex?: number | null };
          stepIndex = payload.stepIndex;
        } catch {
          writeJson(res, 400, { error: "Invalid JSON body" });
          return true;
        }
      }
    }
    if (!state.loopScheduler.hasTask(taskId)) {
      writeJson(res, 404, { error: "task not found" });
      return true;
    }
    const shouldWait = (() => {
      const raw = String(parsed.searchParams.get("wait") || "").trim().toLowerCase();
      return raw === "1" || raw === "true" || raw === "yes";
    })();
    try {
      const resolvedStepIndex = state.loopScheduler.resolveResumeStepIndex(taskId, stepIndex);
      if (shouldWait) {
        const run = await state.loopScheduler.resumeNow(taskId, resolvedStepIndex);
        writeJson(res, 200, { item: run });
        return true;
      }
      void state.loopScheduler.resumeNow(taskId, resolvedStepIndex).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[loop] async resume failed taskId=${taskId} error=${message}`);
      });
      writeJson(res, 202, { ok: true, accepted: true, async: true, stepIndex: resolvedStepIndex });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message === "task not found" ? 404 : 400;
      writeJson(res, status, { error: message });
      return true;
    }
  }

  if (req.method === "POST" && parsed.pathname.startsWith("/__loop/api/tasks/") && parsed.pathname.endsWith("/toggle")) {
    const taskId = parseTaskId(parsed.pathname, "toggle");
    if (!taskId) {
      writeJson(res, 404, { error: "Not found" });
      return true;
    }
    try {
      const task = await state.loopScheduler.toggleTask(taskId);
      writeJson(res, 200, { item: task });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  if (req.method === "POST" && parsed.pathname.startsWith("/__loop/api/tasks/") && parsed.pathname.endsWith("/stop")) {
    const taskId = parseTaskId(parsed.pathname, "stop");
    if (!taskId) {
      writeJson(res, 404, { error: "Not found" });
      return true;
    }
    const exists = state.loopScheduler.listTasks().some((item) => item.id === taskId);
    if (!exists) {
      writeJson(res, 404, { error: "task not found" });
      return true;
    }
    try {
      const item = state.loopScheduler.stopTask(taskId, "task stopped manually");
      writeJson(res, 200, { item });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  if (req.method === "POST" && parsed.pathname.startsWith("/__loop/api/tasks/") && parsed.pathname.endsWith("/stop-after-round")) {
    const taskId = parseTaskId(parsed.pathname, "stop-after-round");
    if (!taskId) {
      writeJson(res, 404, { error: "Not found" });
      return true;
    }
    const exists = state.loopScheduler.listTasks().some((item) => item.id === taskId);
    if (!exists) {
      writeJson(res, 404, { error: "task not found" });
      return true;
    }
    try {
      const item = state.loopScheduler.stopTask(taskId, "stop requested after current round", { afterRound: true });
      writeJson(res, 200, { item });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  if (req.method === "DELETE" && parsed.pathname.startsWith("/__loop/api/tasks/")) {
    const taskId = parseTaskId(parsed.pathname, null);
    if (!taskId) {
      writeJson(res, 404, { error: "Not found" });
      return true;
    }
    try {
      const stopInfo = state.loopScheduler.stopTask(taskId, "task deleted");
      await state.loopScheduler.deleteTask(taskId);
      writeJson(res, 200, { ok: true, item: stopInfo });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
      return true;
    }
  }

  writeJson(res, 404, { error: "Not found" });
  return true;
}

export async function startServer(config: AppConfig, configPath: string): Promise<StartedServer> {
  const loopScheduler = new LoopScheduler(join(dirname(configPath), "loop-tasks.json"));
  void loopScheduler.init().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[loop] init failed: ${message}`);
  });

  const logFilePath = resolveLogFilePath(configPath, config.logging.filePath);
  const state: RuntimeState = {
    config,
    logFilePath,
    logger: new LoggerService({
      ...config.logging,
      filePath: logFilePath
    }),
    configPath,
    loopScheduler
  };

  const server = createServer(async (req, res) => {
    const requestId = newRequestId();

    try {
      const homeHandled = await handleHome(req, res);
      if (homeHandled) {
        return;
      }

      const loopHandled = await handleLoop(req, res, state);
      if (loopHandled) {
        return;
      }

      const adminHandled = await handleAdmin(req, res, state);
      if (adminHandled) {
        return;
      }

      const body = await collectBody(req);
      const decision = resolveRouting(state.config, req);
      const contentType = Array.isArray(req.headers["content-type"])
        ? req.headers["content-type"][0]
        : req.headers["content-type"];

      state.logger.logRequest({
        ts: new Date().toISOString(),
        requestId,
        method: req.method ?? "GET",
        path: req.url ?? "/",
        provider: decision.providerName,
        headers: req.headers,
        rawBody: body,
        contentType
      });

      const maxCaptureBytes = state.config.logging.archiveRequests
        ? 0
        : Math.max(0, state.config.logging.maxBodyBytes ?? 65536);

      const response = await forwardRequest({
        req,
        res,
        body,
        decision,
        timeoutMs: state.config.requestTimeoutMs ?? 120000,
        // When archive is disabled, keep response capture bounded to avoid unbounded memory use.
        // <= 0 means unlimited in forwardRequest.
        maxCaptureBytes
      });

      state.logger.logResponse({
        ts: new Date().toISOString(),
        requestId,
        method: req.method ?? "GET",
        path: req.url ?? "/",
        provider: decision.providerName,
        statusCode: response.statusCode,
        headers: response.headers,
        rawBody: response.responseBody,
        contentType: response.contentType,
        truncated: response.truncated
      });
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        if (!res.headersSent) {
          writeJson(res, error.statusCode, { error: error.message, requestId });
        }
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const isTimeout = message.toLowerCase().includes("timed out");
      const code = isTimeout ? 504 : 502;
      state.logger.logResponse({
        ts: new Date().toISOString(),
        requestId,
        method: req.method ?? "GET",
        path: req.url ?? "/",
        provider: "proxy_error",
        statusCode: code,
        headers: {},
        rawBody: Buffer.from(JSON.stringify({ error: message }), "utf8"),
        contentType: "application/json",
        truncated: false
      });
      console.error(`[proxy] request failed requestId=${requestId} error=${message}`);
      writeProxyError(res, code, requestId, message);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.listen.port, config.listen.host, () => {
      server.off("error", reject);
      console.log(
        `[agent-lens] listening on http://${config.listen.host}:${config.listen.port} defaultProvider=${config.routing.defaultProvider}`
      );
      resolve();
    });
  });

  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
    shutdownLoop: () => {
      loopScheduler.shutdown();
      for (const task of loopScheduler.listTasks()) {
        loopScheduler.stopTask(task.id, "scheduler shutting down");
      }
    }
  };
}
