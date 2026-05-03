import http, { ClientRequest, IncomingHttpHeaders, IncomingMessage, RequestOptions, ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import https from "node:https";
import { URL } from "node:url";
import { RoutingDecision } from "../provider/types";

type ForwardRequest = {
  req: IncomingMessage;
  res: ServerResponse;
  decision: RoutingDecision;
  timeoutMs: number;
  maxCaptureBytes: number;
  providerNameHeader?: string;
  requestBodyFilePath?: string;
  requestBodyReady?: Promise<void>;
};

export type ForwardResult = {
  statusCode: number;
  headers: IncomingHttpHeaders;
  responseBody: Buffer;
  contentType?: string;
  truncated: boolean;
};

const MAX_UPSTREAM_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 800;
const RETRY_MAX_DELAY_MS = 8000;

function isRetryableStatus(statusCode: number | undefined): boolean {
  if (typeof statusCode !== "number" || !Number.isFinite(statusCode)) {
    return false;
  }
  return statusCode === 429 || statusCode >= 500;
}

function parseRetryAfterMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const asSeconds = Number(text);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.max(0, Math.floor(asSeconds * 1000));
  }
  const atMs = Date.parse(text);
  if (!Number.isFinite(atMs)) {
    return null;
  }
  return Math.max(0, atMs - Date.now());
}

function exponentialBackoffMs(attempt: number): number {
  const factor = Math.max(0, attempt - 1);
  const next = RETRY_BASE_DELAY_MS * (2 ** factor);
  return Math.min(RETRY_MAX_DELAY_MS, next);
}

function retryDelayMs(statusCode: number | undefined, headers: IncomingHttpHeaders | undefined, attempt: number): number {
  if (statusCode === 429 && headers) {
    const raw = Array.isArray(headers["retry-after"]) ? headers["retry-after"][0] : headers["retry-after"];
    const parsed = parseRetryAfterMs(raw);
    if (parsed != null) {
      return Math.min(RETRY_MAX_DELAY_MS, parsed);
    }
  }
  return exponentialBackoffMs(attempt);
}

function buildForwardHeaders(
  headers: IncomingHttpHeaders,
  upstreamHost: string,
  hostHeader: string | undefined,
  providerNameHeader: string | undefined
): IncomingHttpHeaders {
  const out: IncomingHttpHeaders = { ...headers };

  // Never forward downstream Host (e.g. 127.0.0.1:5290) to upstream.
  // Some gateways reject TLS/HTTP when Host and upstream target mismatch.
  out.host = hostHeader || upstreamHost;

  if (providerNameHeader) {
    delete out[providerNameHeader.toLowerCase()];
  }

  return out;
}

function canReplayRequestBody(input: ForwardRequest): boolean {
  return Boolean(input.requestBodyFilePath && input.requestBodyReady);
}

function canRetryRequest(input: ForwardRequest, attempt: number): boolean {
  if (attempt >= MAX_UPSTREAM_RETRY_ATTEMPTS || input.res.headersSent) {
    return false;
  }
  const method = String(input.req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }
  return canReplayRequestBody(input);
}

function requestMayHaveBody(req: IncomingMessage): boolean {
  const method = String(req.method || "GET").toUpperCase();
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function getHeaderValue(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function hasUnsupportedRequestEncoding(headers: IncomingHttpHeaders): boolean {
  const contentEncoding = getHeaderValue(headers, "content-encoding").trim().toLowerCase();
  return Boolean(contentEncoding && contentEncoding !== "identity");
}

function isAnthropicRequest(req: IncomingMessage, decision: RoutingDecision): boolean {
  if (decision.apiFormat === "anthropic") {
    return true;
  }
  if (req.headers["anthropic-version"]) {
    return true;
  }
  const path = (decision.targetPathWithQuery || req.url || "/").split("?")[0];
  return path === "/v1/messages" || path === "/v1/complete";
}

function collectIncomingBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const cleanup = (): void => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
    };
    const settleResolve = (body: Buffer): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(body);
    };
    const settleReject = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const onData = (chunk: Buffer | string): void => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };
    const onEnd = (): void => {
      settleResolve(Buffer.concat(chunks));
    };
    const onError = (error: Error): void => {
      settleReject(error);
    };
    const onAborted = (): void => {
      settleReject(new Error("Downstream request aborted"));
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });
}

async function readOriginalRequestBody(input: ForwardRequest): Promise<Buffer> {
  if (input.requestBodyFilePath && input.requestBodyReady) {
    await input.requestBodyReady;
    return readFile(input.requestBodyFilePath);
  }
  return collectIncomingBody(input.req);
}

function rewriteAnthropicModelBody(rawBody: Buffer, modelOverride: string): Buffer {
  const rawText = rawBody.toString("utf8");
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return rawBody;
    }
    const rewritten = { ...(parsed as Record<string, unknown>), model: modelOverride };
    return Buffer.from(JSON.stringify(rewritten), "utf8");
  } catch {
    return rawBody;
  }
}

function shouldPrepareAnthropicModelOverride(input: ForwardRequest): boolean {
  const modelOverride = input.decision.provider.modelOverride?.trim();
  return Boolean(
    modelOverride
      && requestMayHaveBody(input.req)
      && isAnthropicRequest(input.req, input.decision)
      && !hasUnsupportedRequestEncoding(input.req.headers)
  );
}

function prepareUpstreamBody(input: ForwardRequest): Promise<Buffer> | null {
  const modelOverride = input.decision.provider.modelOverride?.trim();
  if (!modelOverride || !shouldPrepareAnthropicModelOverride(input)) {
    return null;
  }
  return readOriginalRequestBody(input).then((rawBody) => rewriteAnthropicModelBody(rawBody, modelOverride));
}

function buildRequestOptions(
  base: URL,
  isHttps: boolean,
  method: string | undefined,
  upstreamPath: string,
  headers: IncomingHttpHeaders,
  timeoutMs: number,
  upstreamBody: Buffer | null
): RequestOptions {
  const requestHeaders = upstreamBody
    ? {
        ...headers,
        "content-length": String(upstreamBody.length),
        "transfer-encoding": undefined
      }
    : headers;
  if (upstreamBody) {
    delete requestHeaders["transfer-encoding"];
  }
  return {
    protocol: base.protocol,
    hostname: base.hostname,
    port: base.port ? Number(base.port) : isHttps ? 443 : 80,
    method,
    path: upstreamPath,
    headers: requestHeaders,
    timeout: timeoutMs
  };
}

export function forwardRequest(input: ForwardRequest): Promise<ForwardResult> {
  const { req, res, decision, timeoutMs } = input;
  const base = new URL(decision.provider.baseURL);
  const isHttps = base.protocol === "https:";
  const requestedPath = `${decision.targetPathWithQuery || "/"}`;
  const normalizedRequestedPath = requestedPath.startsWith("/") ? requestedPath : `/${requestedPath}`;
  const basePath = (base.pathname || "/").replace(/\/+$/, "");
  const upstreamPath =
    !basePath || basePath === "/"
      ? normalizedRequestedPath
      : normalizedRequestedPath === basePath || normalizedRequestedPath.startsWith(`${basePath}/`)
        ? normalizedRequestedPath
        : `${basePath}${normalizedRequestedPath}`;

  const upstreamHost = base.host;
  const headers = buildForwardHeaders(req.headers, upstreamHost, decision.provider.hostHeader, input.providerNameHeader);

  if (decision.provider.authMode && decision.provider.authMode !== "passthrough") {
    const authValue = decision.provider.authMode.value;
    const prefix = decision.provider.authMode.valuePrefix ?? "";
    const headerKey = decision.provider.authMode.header.toLowerCase();
    if (authValue) {
      headers[headerKey] = `${prefix}${authValue}`;
    }
  }

  const client = isHttps ? https : http;
  const upstreamBodyPromise = prepareUpstreamBody(input);

  return new Promise<ForwardResult>((resolve, reject) => {
    let settled = false;
    let attempt = 1;
    let upstreamReq: ClientRequest | null = null;
    const cleanup = (): void => {
      req.off("aborted", onReqAborted);
      res.off("close", onResClose);
    };
    const settleReject = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const settleResolve = (result: ForwardResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };
    const destroyUpstream = (reason: string): void => {
      if (upstreamReq && !upstreamReq.destroyed) {
        upstreamReq.destroy(new Error(reason));
      }
    };
    const onReqAborted = (): void => {
      destroyUpstream("Downstream request aborted");
    };
    const onResClose = (): void => {
      if (req.aborted && !res.writableEnded) {
        destroyUpstream("Downstream response connection closed");
      }
    };

    const sendAttempt = (): void => {
      void sendAttemptAsync().catch((error) => {
        settleReject(error instanceof Error ? error : new Error(String(error)));
      });
    };

    const sendAttemptAsync = async (): Promise<void> => {
      const upstreamBody = upstreamBodyPromise ? await upstreamBodyPromise : null;
      if (settled) {
        return;
      }
      const options = buildRequestOptions(base, isHttps, req.method, upstreamPath, headers, timeoutMs, upstreamBody);
      let retryScheduledByTimeout = false;
      const request = client.request(options, (upstreamRes) => {
        if (request !== upstreamReq) {
          upstreamRes.resume();
          return;
        }
        const statusCode = upstreamRes.statusCode;
        if (canRetryRequest(input, attempt) && isRetryableStatus(statusCode)) {
          const delayMs = retryDelayMs(statusCode, upstreamRes.headers, attempt);
          upstreamRes.resume();
          attempt += 1;
          setTimeout(() => {
            if (!settled && request === upstreamReq && !res.headersSent) {
              sendAttempt();
            }
          }, delayMs);
          return;
        }
        const maxBytes = Math.max(0, input.maxCaptureBytes);
        const captured: Buffer[] = [];
        let capturedBytes = 0;
        let truncated = false;
        const contentTypeHeader = Array.isArray(upstreamRes.headers["content-type"])
          ? upstreamRes.headers["content-type"][0]
          : upstreamRes.headers["content-type"];

        const responseHeaders: IncomingHttpHeaders = {
          ...upstreamRes.headers,
          "x-agentlens-upstream-attempts": String(attempt)
        };
        res.writeHead(statusCode ?? 502, responseHeaders);
        upstreamRes.pipe(res);

        upstreamRes.on("data", (chunk) => {
          const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (truncated) {
            return;
          }
          const remain = maxBytes - capturedBytes;
          if (remain <= 0) {
            truncated = true;
            return;
          }
          if (b.length <= remain) {
            captured.push(b);
            capturedBytes += b.length;
            return;
          }
          captured.push(b.subarray(0, remain));
          capturedBytes += remain;
          truncated = true;
        });

        upstreamRes.on("end", () => {
          settleResolve({
            statusCode: statusCode ?? 502,
            headers: upstreamRes.headers,
            responseBody: Buffer.concat(captured),
            contentType: contentTypeHeader,
            truncated
          });
        });

        upstreamRes.on("aborted", () => {
          if (request !== upstreamReq) {
            return;
          }
          settleReject(new Error("Upstream response aborted"));
        });

        upstreamRes.on("error", (error) => {
          if (request !== upstreamReq) {
            return;
          }
          settleReject(error instanceof Error ? error : new Error(String(error)));
        });

        upstreamRes.on("close", () => {
          if (request !== upstreamReq) {
            return;
          }
          if (!upstreamRes.complete) {
            settleReject(new Error("Upstream response closed before complete"));
          }
        });
      });
      upstreamReq = request;

      request.on("timeout", () => {
        if (request !== upstreamReq) {
          return;
        }
        if (canRetryRequest(input, attempt)) {
          const delayMs = exponentialBackoffMs(attempt);
          attempt += 1;
          retryScheduledByTimeout = true;
          request.destroy();
          setTimeout(() => {
            if (!settled && request === upstreamReq && !res.headersSent) {
              sendAttempt();
            }
          }, delayMs);
          return;
        }
        request.destroy(new Error("Upstream request timed out"));
      });

      request.on("error", (error: Error) => {
        if (request !== upstreamReq) {
          return;
        }
        if (settled) {
          return;
        }
        if (retryScheduledByTimeout) {
          return;
        }
        if (canRetryRequest(input, attempt)) {
          const delayMs = exponentialBackoffMs(attempt);
          attempt += 1;
          setTimeout(() => {
            if (!settled && request === upstreamReq && !res.headersSent) {
              sendAttempt();
            }
          }, delayMs);
          return;
        }
        settleReject(error);
      });

      if (upstreamBody) {
        request.end(upstreamBody);
        return;
      }

      if (attempt === 1) {
        req.pipe(request);
        return;
      }

      const method = String(input.req.method || "GET").toUpperCase();
      if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
        request.end();
        return;
      }

      if (!input.requestBodyReady) {
        request.destroy(new Error("Request body replay cache unavailable"));
        return;
      }

      void input.requestBodyReady
        .then(() => {
          if (settled || request !== upstreamReq) {
            return;
          }
          const replay = createReadStream(input.requestBodyFilePath!);
          replay.on("error", (error) => {
            if (request !== upstreamReq || settled) {
              return;
            }
            request.destroy(error instanceof Error ? error : new Error(String(error)));
          });
          replay.pipe(request);
        })
        .catch((error) => {
          if (request !== upstreamReq || settled) {
            return;
          }
          request.destroy(error instanceof Error ? error : new Error(String(error)));
        });
    };

    req.on("aborted", onReqAborted);
    res.on("close", onResClose);
    sendAttempt();
  });
}
