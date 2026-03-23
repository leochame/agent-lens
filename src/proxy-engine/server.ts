import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { AppConfig } from "../provider-router/types";
import { resolveRouting } from "../provider-router/router";
import { LoggerService } from "../logger-service/logger";
import { forwardRequest } from "./forward";
import { newRequestId } from "../utils/request-id";
import { renderAdminHtml } from "../admin-ui/html";
import { saveConfig } from "../config-manager/config";
import { loadArchivedLogDetail, loadPairedLogs } from "../admin-ui/logs";

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
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

type RuntimeState = {
  config: AppConfig;
  logger: LoggerService;
  configPath: string;
};

async function handleAdmin(req: IncomingMessage, res: ServerResponse, state: RuntimeState): Promise<boolean> {
  const reqUrl = req.url ?? "/";
  if (!reqUrl.startsWith("/__admin")) {
    return false;
  }
  const parsed = new URL(reqUrl, "http://127.0.0.1");

  if (req.method === "GET" && parsed.pathname === "/__admin") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderAdminHtml());
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__admin/api/config") {
    writeJson(res, 200, state.config);
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__admin/api/logs") {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(10, Math.min(300, Number(limitRaw))) : 80;
    const items = await loadPairedLogs(state.config.logging.filePath, limit);
    writeJson(res, 200, { items, generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__admin/api/logs/detail") {
    const requestId = (parsed.searchParams.get("requestId") || "").trim();
    const sessionId = (parsed.searchParams.get("sessionId") || "").trim() || null;
    if (!requestId) {
      writeJson(res, 400, { error: "requestId is required" });
      return true;
    }
    const detail = await loadArchivedLogDetail(state.config.logging.filePath, requestId, sessionId);
    writeJson(res, 200, { requestId, sessionId, detail, generatedAt: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && parsed.pathname === "/__admin/api/logs/stream") {
    const limitRaw = parsed.searchParams.get("limit");
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(10, Math.min(300, Number(limitRaw))) : 80;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });
    res.write("retry: 1500\n\n");

    let lastItemsPayload = "";
    const send = async (): Promise<void> => {
      const items = await loadPairedLogs(state.config.logging.filePath, limit);
      const itemsPayload = JSON.stringify(items);
      if (itemsPayload === lastItemsPayload) {
        return;
      }
      lastItemsPayload = itemsPayload;
      const payload = JSON.stringify({ items, generatedAt: new Date().toISOString() });
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

export function startServer(config: AppConfig, configPath: string): void {
  const state: RuntimeState = {
    config,
    logger: new LoggerService(config.logging),
    configPath
  };

  const server = createServer(async (req, res) => {
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

      const response = await forwardRequest({
        req,
        res,
        body,
        decision,
        timeoutMs: state.config.requestTimeoutMs ?? 120000,
        // Full raw response capture for archive/log diagnostics.
        // <= 0 means unlimited in forwardRequest.
        maxCaptureBytes: state.config.logging.maxArchiveBodyBytes ?? 0
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
