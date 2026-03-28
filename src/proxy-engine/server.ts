import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { dirname, join } from "node:path";
import { AppConfig } from "../provider-router/types";
import { resolveRouting } from "../provider-router/router";
import { LoggerService } from "../logger-service/logger";
import { forwardRequest } from "./forward";
import { newRequestId } from "../utils/request-id";
import { renderAdminHtml } from "../admin-ui/html";
import { saveConfig } from "../config-manager/config";
import { cleanupArchivedLogs, loadArchivedLogDetail, loadPairedLogs } from "../admin-ui/logs";
import { ApiFormat } from "../logger-service/archive-path";
import { renderLoopHtml } from "../loop-scheduler/html";
import { LoopScheduler } from "../loop-scheduler/engine";
import { CreateLoopTaskInput, UpdateLoopTaskInput } from "../loop-scheduler/types";

function collectBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
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
  logger: LoggerService;
  configPath: string;
  loopScheduler: LoopScheduler;
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
  if (!reqUrl.startsWith("/__admin")) {
    return false;
  }
  const parsed = new URL(reqUrl, "http://127.0.0.1");

  if (req.method === "GET" && parsed.pathname === "/__admin") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(renderAdminHtml());
    return true;
  }
  if (req.method === "GET" && parsed.pathname === "/__admin/openai") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(renderAdminHtml("openai"));
    return true;
  }
  if (req.method === "GET" && parsed.pathname === "/__admin/anthropic") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(renderAdminHtml("anthropic"));
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
    const items = await loadPairedLogs(state.config.logging.filePath, limit, apiFormat);
    writeJson(res, 200, { items, apiFormat, generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && (parsed.pathname === "/__admin/api/openai/logs" || parsed.pathname === "/__admin/api/anthropic/logs")) {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(10, Math.min(300, Number(limitRaw))) : 80;
    const apiFormat: ApiFormat = parsed.pathname.includes("/openai/") ? "openai" : "anthropic";
    const items = await loadPairedLogs(state.config.logging.filePath, limit, apiFormat);
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
    const detail = await loadArchivedLogDetail(state.config.logging.filePath, requestId, apiFormat, sessionId);
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
    const detail = await loadArchivedLogDetail(state.config.logging.filePath, requestId, apiFormat, sessionId);
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
      const items = await loadPairedLogs(state.config.logging.filePath, limit, apiFormat);
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
    const body = await collectBody(req);
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

    const result = await cleanupArchivedLogs(state.config.logging.filePath, scope, apiFormat);
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
    const body = await collectBody(req);
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
      state.logger = new LoggerService(state.config.logging);
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

export function parseTaskId(pathname: string, action: "run" | "toggle" | "stop" | null): string | null {
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
    const body = await collectBody(req);
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
    const body = await collectBody(req);
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
    const body = await collectBody(req);
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
    const body = await collectBody(req);
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
    const body = await collectBody(req);
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
    try {
      const run = await state.loopScheduler.runNow(taskId);
      writeJson(res, 200, { item: run });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 400, { error: message });
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

export function startServer(config: AppConfig, configPath: string): void {
  const loopScheduler = new LoopScheduler(join(dirname(configPath), "loop-tasks.json"));
  void loopScheduler.init().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[loop] init failed: ${message}`);
  });

  const state: RuntimeState = {
    config,
    logger: new LoggerService(config.logging),
    configPath,
    loopScheduler
  };

  const server = createServer(async (req, res) => {
    const loopHandled = await handleLoop(req, res, state);
    if (loopHandled) {
      return;
    }

    const adminHandled = await handleAdmin(req, res, state);
    if (adminHandled) {
      return;
    }

    const requestId = newRequestId();

    try {
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
        ? (state.config.logging.maxArchiveBodyBytes ?? 0)
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

  server.listen(config.listen.port, config.listen.host, () => {
    console.log(
      `[agent-lens] listening on http://${config.listen.host}:${config.listen.port} defaultProvider=${config.routing.defaultProvider}`
    );
  });
}
