import http, { IncomingHttpHeaders, IncomingMessage, RequestOptions, ServerResponse } from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { RoutingDecision } from "../provider-router/types";

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
      if (!upstreamReq.destroyed) {
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

    const upstreamReq = client.request(options, (upstreamRes) => {
      const maxBytes = Math.max(0, input.maxCaptureBytes);
      const captured: Buffer[] = [];
      let capturedBytes = 0;
      let truncated = false;
      const contentTypeHeader = Array.isArray(upstreamRes.headers["content-type"])
        ? upstreamRes.headers["content-type"][0]
        : upstreamRes.headers["content-type"];

      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
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
          statusCode: upstreamRes.statusCode ?? 502,
          headers: upstreamRes.headers,
          responseBody: Buffer.concat(captured),
          contentType: contentTypeHeader,
          truncated
        });
      });

      upstreamRes.on("aborted", () => {
        settleReject(new Error("Upstream response aborted"));
      });

      upstreamRes.on("error", (error) => {
        settleReject(error instanceof Error ? error : new Error(String(error)));
      });

      upstreamRes.on("close", () => {
        if (!upstreamRes.complete) {
          settleReject(new Error("Upstream response closed before complete"));
        }
      });
    });

    req.on("aborted", onReqAborted);
    res.on("close", onResClose);

    upstreamReq.on("timeout", () => {
      upstreamReq.destroy(new Error("Upstream request timed out"));
    });

    upstreamReq.on("error", (error) => {
      settleReject(error);
    });

    upstreamReq.write(body);
    upstreamReq.end();
  });
}
