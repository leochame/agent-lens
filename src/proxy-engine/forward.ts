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
  hostHeader: string | undefined,
  providerNameHeader: string | undefined
): IncomingHttpHeaders {
  const out: IncomingHttpHeaders = { ...headers };

  if (hostHeader) {
    out.host = hostHeader;
  }

  if (providerNameHeader) {
    delete out[providerNameHeader.toLowerCase()];
  }

  return out;
}

export function forwardRequest(input: ForwardRequest): Promise<ForwardResult> {
  const { req, res, body, decision, timeoutMs } = input;
  const base = new URL(decision.provider.baseURL);
  const isHttps = base.protocol === "https:";
  const upstreamPath = `${decision.targetPathWithQuery}`;

  const headers = buildForwardHeaders(req.headers, decision.provider.hostHeader, undefined);

  if (decision.provider.authMode && decision.provider.authMode !== "passthrough") {
    const envValue = process.env[decision.provider.authMode.valueFromEnv] ?? "";
    const prefix = decision.provider.authMode.valuePrefix ?? "";
    headers[decision.provider.authMode.header.toLowerCase()] = `${prefix}${envValue}`;
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
        resolve({
          statusCode: upstreamRes.statusCode ?? 502,
          headers: upstreamRes.headers,
          responseBody: Buffer.concat(captured),
          contentType: contentTypeHeader,
          truncated
        });
      });
    });

    upstreamReq.on("timeout", () => {
      upstreamReq.destroy(new Error("Upstream request timed out"));
    });

    upstreamReq.on("error", (error) => {
      reject(error);
    });

    req.on("close", () => {
      if (!upstreamReq.destroyed) {
        upstreamReq.destroy();
      }
    });

    upstreamReq.write(body);
    upstreamReq.end();
  });
}
