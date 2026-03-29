import test from "node:test";
import assert from "node:assert/strict";
import http, { IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { forwardRequest } from "./forward";
import { RoutingDecision } from "../provider-router/types";

async function listen(server: http.Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  return (server.address() as AddressInfo).port;
}

async function closeServer(server: http.Server): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve) => server.close(() => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 500))
  ]);
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
}

test("forwardRequest forwards body and inject auth header", async () => {
  let capturedAuth = "";
  let capturedHost = "";
  let capturedBody = "";
  const upstream = http.createServer((req, res) => {
    capturedAuth = String(req.headers.authorization || "");
    capturedHost = String(req.headers.host || "");
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      capturedBody = Buffer.concat(chunks).toString("utf8");
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    });
  });

  const downstream = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", async () => {
      const decision: RoutingDecision = {
        providerName: "openai",
        provider: {
          baseURL: `http://127.0.0.1:${upstreamPort}`,
          authMode: { type: "inject", header: "Authorization", value: "token", valuePrefix: "Bearer " },
          hostHeader: "proxy.test"
        },
        targetPathWithQuery: req.url || "/"
      };
      try {
        await forwardRequest({
          req,
          res,
          body: Buffer.concat(chunks),
          decision,
          timeoutMs: 2000,
          maxCaptureBytes: 1024
        });
      } catch (error) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end(error instanceof Error ? error.message : String(error));
      }
    });
  });

  const upstreamPort = await listen(upstream);
  const downstreamPort = await listen(downstream);
  try {
    const responseText = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: downstreamPort,
          path: "/v1/chat/completions?x=1",
          headers: { "content-type": "application/json", connection: "close" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        }
      );
      req.on("error", reject);
      req.write('{"hello":"world"}');
      req.end();
    });

    assert.equal(responseText, '{"ok":true}');
    assert.equal(capturedAuth, "Bearer token");
    assert.equal(capturedHost, "proxy.test");
    assert.equal(capturedBody, '{"hello":"world"}');
  } finally {
    await closeServer(downstream);
    await closeServer(upstream);
  }
});

test("forwardRequest rejects when upstream response aborts mid-stream", async () => {
  let forwardError: Error | null = null;
  const upstream = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.write("partial");
    setTimeout(() => {
      res.destroy(new Error("boom"));
    }, 10);
  });
  const downstream = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", async () => {
      const decision: RoutingDecision = {
        providerName: "openai",
        provider: { baseURL: `http://127.0.0.1:${upstreamPort}` },
        targetPathWithQuery: req.url || "/"
      };
      try {
        await forwardRequest({
          req,
          res,
          body: Buffer.concat(chunks),
          decision,
          timeoutMs: 2000,
          maxCaptureBytes: 1024
        });
      } catch (error) {
        forwardError = error instanceof Error ? error : new Error(String(error));
        if (!res.headersSent) {
          res.writeHead(502, { "content-type": "text/plain" });
          res.end(forwardError.message);
        } else if (!res.writableEnded) {
          res.end();
        }
      }
    });
  });

  const upstreamPort = await listen(upstream);
  const downstreamPort = await listen(downstream);
  try {
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { method: "POST", host: "127.0.0.1", port: downstreamPort, path: "/x", headers: { connection: "close" } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on("end", () => resolve());
          res.on("close", () => resolve());
        }
      );
      req.on("error", reject);
      req.write("x");
      req.end();
    });
    if (!forwardError) {
      throw new Error("Expected forwardRequest to reject on upstream abort");
    }
    const errorMessage = String((forwardError as Error).message || "");
    assert.match(
      errorMessage,
      /Upstream response aborted|Upstream response closed before complete|socket hang up|aborted/i
    );
  } finally {
    await closeServer(downstream);
    await closeServer(upstream);
  }
});

test("forwardRequest retries once when upstream responds with retryable error", async () => {
  let attempt = 0;
  const upstream = http.createServer((_req, res) => {
    attempt += 1;
    if (attempt === 1) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end('{"error":"temporary"}');
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"ok":true,"attempt":2}');
  });

  const downstream = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", async () => {
      const decision: RoutingDecision = {
        providerName: "openai",
        provider: { baseURL: `http://127.0.0.1:${upstreamPort}` },
        targetPathWithQuery: req.url || "/"
      };
      try {
        await forwardRequest({
          req,
          res,
          body: Buffer.concat(chunks),
          decision,
          timeoutMs: 2000,
          maxCaptureBytes: 1024
        });
      } catch (error) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end(error instanceof Error ? error.message : String(error));
      }
    });
  });

  const upstreamPort = await listen(upstream);
  const downstreamPort = await listen(downstream);
  try {
    const response = await new Promise<{ body: string; upstreamAttempts: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: downstreamPort,
          path: "/v1/chat/completions",
          headers: { "content-type": "application/json", connection: "close" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          const upstreamAttempts = String(res.headers["x-agentlens-upstream-attempts"] || "");
          res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on("end", () =>
            resolve({
              body: Buffer.concat(chunks).toString("utf8"),
              upstreamAttempts
            })
          );
        }
      );
      req.on("error", reject);
      req.write('{"hello":"retry"}');
      req.end();
    });

    assert.equal(attempt, 2);
    assert.equal(response.body, '{"ok":true,"attempt":2}');
    assert.equal(response.upstreamAttempts, "2");
  } finally {
    await closeServer(downstream);
    await closeServer(upstream);
  }
});
