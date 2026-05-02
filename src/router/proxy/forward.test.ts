import test from "node:test";
import assert from "node:assert/strict";
import http, { IncomingMessage, ServerResponse } from "node:http";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { forwardRequest } from "./forward";
import { RoutingDecision } from "../provider/types";

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

async function createReplayCache(req: IncomingMessage): Promise<{
  filePath: string;
  ready: Promise<void>;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-forward-test-"));
  const filePath = join(dir, "body.bin");
  const writer = createWriteStream(filePath);
  const ready = new Promise<void>((resolve, reject) => {
    writer.on("finish", () => resolve());
    writer.on("error", reject);
    req.on("aborted", () => writer.destroy(new Error("Downstream request aborted")));
    req.on("error", (error) => writer.destroy(error));
  });
  req.pipe(writer);
  return {
    filePath,
    ready,
    cleanup: async () => {
      writer.destroy();
      await rm(dir, { recursive: true, force: true });
    }
  };
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
    void (async () => {
      const replayCache = await createReplayCache(req);
      const decision: RoutingDecision = {
        providerName: "openai",
        apiFormat: "openai",
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
          decision,
          timeoutMs: 2000,
          maxCaptureBytes: 1024,
          requestBodyFilePath: replayCache.filePath,
          requestBodyReady: replayCache.ready
        });
      } catch (error) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end(error instanceof Error ? error.message : String(error));
      } finally {
        await replayCache.cleanup();
      }
    })();
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

test("forwardRequest assembles Anthropic upstream request with stripped path and injected auth", async () => {
  let captured = {
    path: "",
    host: "",
    authorization: "",
    contentType: "",
    anthropicVersion: "",
    targetProvider: "",
    contentLength: "",
    body: ""
  };
  const upstream = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      captured = {
        path: req.url ?? "",
        host: String(req.headers.host || ""),
        authorization: String(req.headers.authorization || ""),
        contentType: String(req.headers["content-type"] || ""),
        anthropicVersion: String(req.headers["anthropic-version"] || ""),
        targetProvider: String(req.headers["x-target-provider"] || ""),
        contentLength: String(req.headers["content-length"] || ""),
        body: Buffer.concat(chunks).toString("utf8")
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"type":"message","content":[{"type":"text","text":"ok"}]}');
    });
  });

  const downstream = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const replayCache = await createReplayCache(req);
      const decision: RoutingDecision = {
        providerName: "智谱-ruoli",
        apiFormat: "anthropic",
        provider: {
          baseURL: `http://127.0.0.1:${upstreamPort}`,
          authMode: { type: "inject", header: "authorization", value: "provider-token", valuePrefix: "Bearer " },
          modelOverride: "glm-5.1"
        },
        targetPathWithQuery: "/v1/messages?beta=true"
      };
      try {
        await forwardRequest({
          req,
          res,
          decision,
          timeoutMs: 2000,
          maxCaptureBytes: 1024,
          providerNameHeader: "x-target-provider",
          requestBodyFilePath: replayCache.filePath,
          requestBodyReady: replayCache.ready
        });
      } catch (error) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end(error instanceof Error ? error.message : String(error));
      } finally {
        await replayCache.cleanup();
      }
    })();
  });

  const upstreamPort = await listen(upstream);
  const downstreamPort = await listen(downstream);
  const requestBody = JSON.stringify({ model: "claude-3-5-sonnet-latest", max_tokens: 16, messages: [{ role: "user", content: "reply ok" }] });

  try {
    const responseText = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: downstreamPort,
          path: "/anthropic/v1/messages?beta=true",
          headers: {
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
            "x-target-provider": "anthropic-route",
            authorization: "Bearer downstream-token"
          }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        }
      );
      req.on("error", reject);
      req.end(requestBody);
    });

    assert.equal(responseText, '{"type":"message","content":[{"type":"text","text":"ok"}]}');
    assert.equal(captured.path, "/v1/messages?beta=true");
    assert.equal(captured.host, `127.0.0.1:${upstreamPort}`);
    assert.equal(captured.authorization, "Bearer provider-token");
    assert.equal(captured.contentType, "application/json");
    assert.equal(captured.anthropicVersion, "2023-06-01");
    assert.equal(captured.targetProvider, "");
    assert.equal(Number(captured.contentLength), Buffer.byteLength(captured.body));
    assert.deepEqual(JSON.parse(captured.body), {
      model: "glm-5.1",
      max_tokens: 16,
      messages: [{ role: "user", content: "reply ok" }]
    });
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
    void (async () => {
      const replayCache = await createReplayCache(req);
      const decision: RoutingDecision = {
        providerName: "openai",
        apiFormat: "openai",
        provider: { baseURL: `http://127.0.0.1:${upstreamPort}` },
        targetPathWithQuery: req.url || "/"
      };
      try {
        await forwardRequest({
          req,
          res,
          decision,
          timeoutMs: 2000,
          maxCaptureBytes: 1024,
          requestBodyFilePath: replayCache.filePath,
          requestBodyReady: replayCache.ready
        });
      } catch (error) {
        forwardError = error instanceof Error ? error : new Error(String(error));
        if (!res.headersSent) {
          res.writeHead(502, { "content-type": "text/plain" });
          res.end(forwardError.message);
        } else if (!res.writableEnded) {
          res.end();
        }
      } finally {
        await replayCache.cleanup();
      }
    })();
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

test("forwardRequest does not cancel upstream when downstream response closes after request upload", async () => {
  let upstreamRequestClosed = false;
  let upstreamResponded = false;
  const upstream = http.createServer((req, res) => {
    req.on("close", () => {
      upstreamRequestClosed = true;
    });
    req.resume();
    setTimeout(() => {
      upstreamResponded = true;
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    }, 50);
  });

  const downstream = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const replayCache = await createReplayCache(req);
      const decision: RoutingDecision = {
        providerName: "anthropic",
        apiFormat: "anthropic",
        provider: { baseURL: `http://127.0.0.1:${upstreamPort}` },
        targetPathWithQuery: req.url || "/"
      };
      try {
        await forwardRequest({
          req,
          res,
          decision,
          timeoutMs: 2000,
          maxCaptureBytes: 1024,
          requestBodyFilePath: replayCache.filePath,
          requestBodyReady: replayCache.ready
        });
      } catch (error) {
        if (!res.headersSent) {
          res.writeHead(502, { "content-type": "text/plain" });
          res.end(error instanceof Error ? error.message : String(error));
        }
      } finally {
        await replayCache.cleanup();
      }
    })();
  });

  const upstreamPort = await listen(upstream);
  const downstreamPort = await listen(downstream);
  try {
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { method: "POST", host: "127.0.0.1", port: downstreamPort, path: "/v1/messages" },
        (res) => {
          res.resume();
          res.on("end", () => resolve());
        }
      );
      req.on("error", reject);
      req.end('{"model":"glm-5.1"}');
    });

    assert.equal(upstreamResponded, true);
    assert.equal(upstreamRequestClosed, true);
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
    void (async () => {
      const replayCache = await createReplayCache(req);
      const decision: RoutingDecision = {
        providerName: "openai",
        apiFormat: "openai",
        provider: { baseURL: `http://127.0.0.1:${upstreamPort}` },
        targetPathWithQuery: req.url || "/"
      };
      try {
        await forwardRequest({
          req,
          res,
          decision,
          timeoutMs: 2000,
          maxCaptureBytes: 1024,
          requestBodyFilePath: replayCache.filePath,
          requestBodyReady: replayCache.ready
        });
      } catch (error) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end(error instanceof Error ? error.message : String(error));
      } finally {
        await replayCache.cleanup();
      }
    })();
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

test("forwardRequest does not retry POST without request body replay cache", async () => {
  let attempt = 0;
  const upstream = http.createServer((req, res) => {
    attempt += 1;
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      if (attempt === 1) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end('{"error":"temporary"}');
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(`{"ok":true,"attempt":${attempt},"body":"${Buffer.concat(chunks).toString("utf8")}"}`);
    });
  });

  const downstream = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const decision: RoutingDecision = {
        providerName: "openai",
        apiFormat: "openai",
        provider: { baseURL: `http://127.0.0.1:${upstreamPort}` },
        targetPathWithQuery: req.url || "/"
      };
      try {
        await forwardRequest({
          req,
          res,
          decision,
          timeoutMs: 2000,
          maxCaptureBytes: 1024
        });
      } catch (error) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end(error instanceof Error ? error.message : String(error));
      }
    })();
  });

  const upstreamPort = await listen(upstream);
  const downstreamPort = await listen(downstream);
  try {
    const response = await new Promise<{ body: string; statusCode: number }>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: downstreamPort,
          path: "/v1/responses",
          headers: { "content-type": "application/json", connection: "close" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on("end", () =>
            resolve({
              body: Buffer.concat(chunks).toString("utf8"),
              statusCode: res.statusCode ?? 0
            })
          );
        }
      );
      req.on("error", reject);
      req.write('{"hello":"no-cache"}');
      req.end();
    });

    assert.equal(attempt, 1);
    assert.equal(response.statusCode, 502);
    assert.equal(response.body, '{"error":"temporary"}');
  } finally {
    await closeServer(downstream);
    await closeServer(upstream);
  }
});
