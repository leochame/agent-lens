import http, { ClientRequest, IncomingHttpHeaders, IncomingMessage, RequestOptions, ServerResponse } from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { RoutingDecision } from "../provider/types";

type ForwardRequest = {
  req: IncomingMessage;
  res: ServerResponse;
  body: Buffer;
  decision: RoutingDecision;
  timeoutMs: number;
  maxCaptureBytes: number;
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

export function forwardRequest(input: ForwardRequest): Promise<ForwardResult> {
  const { req, res, body, decision, timeoutMs } = input;
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
  const headers = buildForwardHeaders(req.headers, upstreamHost, decision.provider.hostHeader, undefined);

  if (decision.provider.authMode && decision.provider.authMode !== "passthrough") {
    const directValue = decision.provider.authMode.value;
    const envKey = decision.provider.authMode.valueFromEnv;
    const envValue = envKey ? process.env[envKey] : undefined;
    const resolvedValue =
      typeof directValue === "string" && directValue.length > 0
        ? directValue
        : typeof envValue === "string" && envValue.length > 0
          ? envValue
          : undefined;
    const prefix = decision.provider.authMode.valuePrefix ?? "";
    const headerKey = decision.provider.authMode.header.toLowerCase();
    if (resolvedValue) {
      headers[headerKey] = `${prefix}${resolvedValue}`;
    }
  }

  const options: RequestOptions = {
    protocol: base.protocol,
    hostname: base.hostname,
    port: base.port ? Number(base.port) : isHttps ? 443 : 80,
    method: req.method,
    path: upstreamPath,
    headers,
    timeout: timeoutMs
  };

  const client = isHttps ? https : http;

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
      if (!res.writableEnded) {
        destroyUpstream("Downstream response connection closed");
      }
    };

    const sendAttempt = (): void => {
      let retryScheduledByTimeout = false;
      const request = client.request(options, (upstreamRes) => {
        if (request !== upstreamReq) {
          upstreamRes.resume();
          return;
        }
        const statusCode = upstreamRes.statusCode;
        if (attempt < MAX_UPSTREAM_RETRY_ATTEMPTS && isRetryableStatus(statusCode) && !res.headersSent) {
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
          // maxBytes <= 0 means unlimited capture (full archive mode).
          if (maxBytes <= 0) {
            captured.push(b);
            capturedBytes += b.length;
            return;
          }
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
        if (attempt < MAX_UPSTREAM_RETRY_ATTEMPTS && !res.headersSent) {
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
        if (attempt < MAX_UPSTREAM_RETRY_ATTEMPTS && !res.headersSent) {
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

      request.write(body);
      request.end();
    };

    req.on("aborted", onReqAborted);
    res.on("close", onResClose);
    sendAttempt();
  });
}
