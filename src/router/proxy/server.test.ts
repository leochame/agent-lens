import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./server";
import { AppConfig } from "../provider/types";
import { loadArchivedLogDetail, loadPairedLogs } from "../../log/archive";

async function closeServer(server: http.Server): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve) => server.close(() => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 500))
  ]);
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
}

async function waitForFile(path: string, timeoutMs = 1500): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  await access(path);
}

function createConfig(port: number): AppConfig {
  return {
    listen: { host: "127.0.0.1", port },
    routing: { defaultProvider: "openai" },
    providers: {
      openai: { baseURL: "https://api.openai.example" }
    },
    logging: { filePath: "logs/req.log" }
  };
}

async function reservePort(): Promise<number> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert(address && typeof address === "object");
  const { port } = address;
  await closeServer(server);
  return port;
}

test("startServer rejects when listen port is already in use", async () => {
  const occupied = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise<void>((resolve) => occupied.listen(0, "127.0.0.1", () => resolve()));
  const address = occupied.address();
  assert(address && typeof address === "object");
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  try {
    await assert.rejects(
      startServer(createConfig(address.port), join(dir, "config/default.yaml")),
      (error: unknown) => {
        assert(error instanceof Error);
        assert.match(String((error as NodeJS.ErrnoException).code || ""), /EADDRINUSE/);
        return true;
      }
    );
  } finally {
    await closeServer(occupied);
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer rejects oversized admin request bodies with 413", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  const port = await reservePort();
  await mkdir(join(dir, "config"), { recursive: true });
  const started = await startServer(createConfig(port), join(dir, "config/default.yaml"));

  try {
    const oversizedBody = Buffer.alloc((10 * 1024 * 1024) + 1, 97);
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "PUT",
          host: "127.0.0.1",
          port,
          path: "/__admin/api/config",
          headers: {
            "content-type": "application/json",
            "content-length": String(oversizedBody.length)
          }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8")
            });
          });
        }
      );
      req.on("error", reject);
      req.end(oversizedBody);
    });

    assert.equal(response.statusCode, 413);
    assert.match(response.body, /Request body exceeds 10485760 bytes/);
  } finally {
    await started.close();
    started.shutdownLoop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer forwards proxied request bodies larger than 10 MiB", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  const upstreamPort = await reservePort();
  const proxyPort = await reservePort();
  const upstream = http.createServer((req, res) => {
    let totalBytes = 0;
    req.on("data", (chunk) => {
      totalBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
    });
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, totalBytes }));
    });
  });
  await new Promise<void>((resolve) => upstream.listen(upstreamPort, "127.0.0.1", () => resolve()));
  await mkdir(join(dir, "config"), { recursive: true });
  const started = await startServer(
    {
      listen: { host: "127.0.0.1", port: proxyPort },
      routing: { defaultProvider: "openai" },
      providers: {
        openai: { baseURL: `http://127.0.0.1:${upstreamPort}` }
      },
      logging: { filePath: "logs/req.log", archiveRequests: false }
    },
    join(dir, "config/default.yaml")
  );

  try {
    const largeBody = Buffer.alloc((10 * 1024 * 1024) + 1, 97);
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: proxyPort,
          path: "/v1/audio/transcriptions",
          headers: {
            "content-type": "application/octet-stream",
            "content-length": String(largeBody.length)
          }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8")
            });
          });
        }
      );
      req.on("error", reject);
      req.end(largeBody);
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /"ok":true/);
    assert.match(response.body, new RegExp(`"totalBytes":${largeBody.length}`));
  } finally {
    await started.close();
    started.shutdownLoop();
    await closeServer(upstream);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer writes relative log files under the config directory instead of cwd", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  const upstreamPort = await reservePort();
  const proxyPort = await reservePort();
  const prevCwd = process.cwd();
  const cwdDir = await mkdtemp(join(tmpdir(), "agent-lens-server-cwd-"));
  const upstream = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, echoed: Buffer.concat(chunks).toString("utf8") }));
    });
  });
  await new Promise<void>((resolve) => upstream.listen(upstreamPort, "127.0.0.1", () => resolve()));

  await mkdir(join(dir, "config"), { recursive: true });
  process.chdir(cwdDir);
  const started = await startServer(
    {
      listen: { host: "127.0.0.1", port: proxyPort },
      routing: { defaultProvider: "openai" },
      providers: {
        openai: { baseURL: `http://127.0.0.1:${upstreamPort}` }
      },
      logging: { filePath: "logs/req.log", archiveRequests: true }
    },
    join(dir, "config/default.yaml")
  );

  try {
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: proxyPort,
          path: "/v1/chat/completions",
          headers: { "content-type": "application/json" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8")
            });
          });
        }
      );
      req.on("error", reject);
      req.end(JSON.stringify({ model: "gpt-5", input: "hello" }));
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /"ok":true/);

    const expectedLogPath = join(dir, "config", "logs", "req.log");
    await waitForFile(expectedLogPath);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await assert.rejects(access(join(cwdDir, "logs", "req.log")));
  } finally {
    process.chdir(prevCwd);
    await started.close();
    started.shutdownLoop();
    await closeServer(upstream);
    await rm(cwdDir, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer returns contextual 502 details when upstream is unreachable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  const proxyPort = await reservePort();
  const unreachablePort = await reservePort();
  const started = await startServer(
    {
      listen: { host: "127.0.0.1", port: proxyPort },
      routing: { defaultProvider: "ruoli.dev - gpt" },
      providers: {
        "ruoli.dev - gpt": { baseURL: `http://127.0.0.1:${unreachablePort}` }
      },
      logging: { filePath: "logs/req.log", archiveRequests: false }
    },
    join(dir, "config/default.yaml")
  );

  try {
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: proxyPort,
          path: "/v1/responses",
          headers: { "content-type": "application/json" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8")
            });
          });
        }
      );
      req.on("error", reject);
      req.end(JSON.stringify({ model: "gpt-4.1-mini", input: "hello" }));
    });

    assert.equal(response.statusCode, 502);
    const parsed = JSON.parse(response.body) as { error?: string };
    assert.match(String(parsed.error || ""), /Gateway error contacting provider "ruoli\.dev - gpt"/);
    assert.match(String(parsed.error || ""), new RegExp(`127\\.0\\.0\\.1:${unreachablePort}`));
  } finally {
    await started.close();
    started.shutdownLoop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer keeps __admin as a compatibility redirect to __log", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  const port = await reservePort();
  const started = await startServer(createConfig(port), join(dir, "config/default.yaml"));

  try {
    const response = await new Promise<{ statusCode: number; location: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "GET",
          host: "127.0.0.1",
          port,
          path: "/__admin"
        },
        (res) => {
          resolve({
            statusCode: res.statusCode ?? 0,
            location: String(res.headers.location || "")
          });
        }
      );
      req.on("error", reject);
      req.end();
    });

    assert.equal(response.statusCode, 302);
    assert.equal(response.location, "/__log");
  } finally {
    await started.close();
    started.shutdownLoop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer keeps GET / available for proxied upstream traffic", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  const upstreamPort = await reservePort();
  const proxyPort = await reservePort();
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ path: req.url ?? "" }));
  });
  await new Promise<void>((resolve) => upstream.listen(upstreamPort, "127.0.0.1", () => resolve()));
  const started = await startServer(
    {
      listen: { host: "127.0.0.1", port: proxyPort },
      routing: { defaultProvider: "openai" },
      providers: {
        openai: { baseURL: `http://127.0.0.1:${upstreamPort}` }
      },
      logging: { filePath: "logs/req.log", archiveRequests: false }
    },
    join(dir, "config/default.yaml")
  );

  try {
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "GET",
          host: "127.0.0.1",
          port: proxyPort,
          path: "/"
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8")
            });
          });
        }
      );
      req.on("error", reject);
      req.end();
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, JSON.stringify({ path: "/" }));
  } finally {
    await started.close();
    started.shutdownLoop();
    await closeServer(upstream);
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer strips configured Anthropic route prefixes before forwarding upstream", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  const upstreamPort = await reservePort();
  const proxyPort = await reservePort();
  let capturedPath = "";
  const upstream = http.createServer((req, res) => {
    capturedPath = req.url ?? "";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, path: capturedPath }));
  });
  await new Promise<void>((resolve) => upstream.listen(upstreamPort, "127.0.0.1", () => resolve()));
  const started = await startServer(
    {
      listen: { host: "127.0.0.1", port: proxyPort },
      routing: {
        defaultProvider: "openai",
        routes: [
          { pathPrefix: "/openai", provider: "openai", apiFormat: "openai", stripPrefix: true },
          { pathPrefix: "/anthropic", provider: "anthropic", apiFormat: "anthropic", stripPrefix: true }
        ]
      },
      providers: {
        openai: { baseURL: `http://127.0.0.1:${upstreamPort}` },
        anthropic: { baseURL: `http://127.0.0.1:${upstreamPort}` }
      },
      logging: { filePath: "logs/req.log", archiveRequests: false }
    },
    join(dir, "config/default.yaml")
  );

  try {
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: proxyPort,
          path: "/anthropic/v1/messages?beta=1",
          headers: { "content-type": "application/json" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8")
            });
          });
        }
      );
      req.on("error", reject);
      req.end(JSON.stringify({ message: "hello" }));
    });

    assert.equal(response.statusCode, 200);
    assert.equal(capturedPath, "/v1/messages?beta=1");
    assert.match(response.body, /"path":"\/v1\/messages\?beta=1"/);
  } finally {
    await started.close();
    started.shutdownLoop();
    await closeServer(upstream);
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer overrides Anthropic model for upstream while archiving original request", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  const upstreamPort = await reservePort();
  const proxyPort = await reservePort();
  const originalPayload = {
    model: "claude-3-5-sonnet-latest",
    max_tokens: 16,
    messages: [{ role: "user", content: "hello" }]
  };
  let capturedBody = "";
  const upstream = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      capturedBody = Buffer.concat(chunks).toString("utf8");
      const parsed = JSON.parse(capturedBody) as { model?: string };
      res.writeHead(parsed.model === "glm-5.1" ? 200 : 400, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "message", content: [{ type: "text", text: "OK" }], receivedModel: parsed.model }));
    });
  });
  await new Promise<void>((resolve) => upstream.listen(upstreamPort, "127.0.0.1", () => resolve()));
  const started = await startServer(
    {
      listen: { host: "127.0.0.1", port: proxyPort },
      routing: {
        defaultProvider: "anthropic",
        routes: [{ pathPrefix: "/anthropic", provider: "anthropic", apiFormat: "anthropic", stripPrefix: true }]
      },
      providers: {
        anthropic: { baseURL: `http://127.0.0.1:${upstreamPort}`, modelOverride: "glm-5.1" }
      },
      logging: { filePath: "logs/req.log", archiveRequests: true, maxArchiveBodyBytes: 0 }
    },
    join(dir, "config/default.yaml")
  );
  let closed = false;

  try {
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: proxyPort,
          path: "/anthropic/v1/messages",
          headers: { "content-type": "application/json", "anthropic-version": "2023-06-01" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
          });
        }
      );
      req.on("error", reject);
      req.end(JSON.stringify(originalPayload));
    });

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(capturedBody).model, "glm-5.1");

    await started.close();
    closed = true;
    const logPath = join(dir, "config", "logs", "req.log");
    const items = await loadPairedLogs(logPath, 20, "anthropic");
    assert.equal(items.length, 1);
    const detail = await loadArchivedLogDetail(logPath, items[0].requestId, "anthropic", null);
    const requestDetail = detail.request as { body?: { text?: string } };
    assert.deepEqual(JSON.parse(requestDetail.body?.text || "{}"), originalPayload);
  } finally {
    if (!closed) {
      await started.close();
    }
    started.shutdownLoop();
    await closeServer(upstream);
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer strips configured OpenAI route prefixes before forwarding upstream", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-server-test-"));
  const upstreamPort = await reservePort();
  const proxyPort = await reservePort();
  let capturedPath = "";
  const upstream = http.createServer((req, res) => {
    capturedPath = req.url ?? "";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, path: capturedPath }));
  });
  await new Promise<void>((resolve) => upstream.listen(upstreamPort, "127.0.0.1", () => resolve()));
  const started = await startServer(
    {
      listen: { host: "127.0.0.1", port: proxyPort },
      routing: {
        defaultProvider: "openai",
        routes: [
          { pathPrefix: "/openai", provider: "openai", apiFormat: "openai", stripPrefix: true }
        ]
      },
      providers: {
        openai: { baseURL: `http://127.0.0.1:${upstreamPort}` }
      },
      logging: { filePath: "logs/req.log", archiveRequests: false }
    },
    join(dir, "config/default.yaml")
  );

  try {
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: proxyPort,
          path: "/openai/chat/completions?stream=true",
          headers: { "content-type": "application/json" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8")
            });
          });
        }
      );
      req.on("error", reject);
      req.end(JSON.stringify({ message: "hello" }));
    });

    assert.equal(response.statusCode, 200);
    assert.equal(capturedPath, "/chat/completions?stream=true");
    assert.match(response.body, /"path":"\/chat\/completions\?stream=true"/);
  } finally {
    await started.close();
    started.shutdownLoop();
    await closeServer(upstream);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(dir, { recursive: true, force: true });
  }
});

test("startServer smoke routes OpenAI and Anthropic through prefix header and format switches", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-router-smoke-test-"));
  const proxyPort = await reservePort();
  const hits: Array<{ provider: string; path: string; auth: string; targetHeader: string }> = [];

  const createUpstream = async (provider: string): Promise<{ server: http.Server; port: number }> => {
    const port = await reservePort();
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on("end", () => {
        const requestBody = Buffer.concat(chunks).toString("utf8");
        const hit = {
          provider,
          path: req.url ?? "",
          auth: String(req.headers.authorization || req.headers["x-api-key"] || ""),
          targetHeader: String(req.headers["x-target-provider"] || "")
        };
        hits.push(hit);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, provider, path: hit.path, auth: hit.auth, targetHeader: hit.targetHeader, requestBody }));
      });
    });
    await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve()));
    return { server, port };
  };

  const openai = await createUpstream("openai-main");
  const anthropicRoute = await createUpstream("anthropic-route");
  const anthropicAuto = await createUpstream("anthropic-auto");

  const started = await startServer(
    {
      listen: { host: "127.0.0.1", port: proxyPort },
      routing: {
        defaultProvider: "openai-main",
        routes: [
          { pathPrefix: "/openai", provider: "openai-main", apiFormat: "openai", stripPrefix: true },
          { pathPrefix: "/anthropic", provider: "anthropic-route", apiFormat: "anthropic", stripPrefix: true }
        ],
        byHeader: "x-target-provider",
        autoDetectProviderByFormat: true,
        formatProviders: {
          openai: "openai-main",
          anthropic: "anthropic-auto"
        }
      },
      providers: {
        "openai-main": {
          baseURL: `http://127.0.0.1:${openai.port}`,
          authMode: { type: "inject", header: "authorization", value: "openai-token", valuePrefix: "Bearer " }
        },
        "anthropic-route": {
          baseURL: `http://127.0.0.1:${anthropicRoute.port}`,
          authMode: { type: "inject", header: "x-api-key", value: "route-token" }
        },
        "anthropic-auto": {
          baseURL: `http://127.0.0.1:${anthropicAuto.port}`,
          authMode: { type: "inject", header: "x-api-key", value: "auto-token" }
        }
      },
      logging: { filePath: "logs/req.log", archiveRequests: false }
    },
    join(dir, "config/default.yaml")
  );

  const send = (path: string, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: string }> =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          method: "POST",
          host: "127.0.0.1",
          port: proxyPort,
          path,
          headers: { "content-type": "application/json", ...headers }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.end(JSON.stringify({ model: "smoke", messages: [{ role: "user", content: "hello" }] }));
    });

  const sendAndParse = async (path: string, headers: Record<string, string> = {}): Promise<{
    statusCode: number;
    body: { ok?: boolean; provider?: string; path?: string; auth?: string; targetHeader?: string; requestBody?: string };
  }> => {
    const response = await send(path, headers);
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body, "");
    return { statusCode: response.statusCode, body: JSON.parse(response.body) };
  };

  try {
    const openaiResponse = await sendAndParse("/openai/v1/responses?case=prefix-openai");
    const anthropicRouteResponse = await sendAndParse("/anthropic/v1/messages?case=prefix-anthropic");
    const anthropicFormatResponse = await sendAndParse("/v1/messages?case=format-anthropic", { "anthropic-version": "2023-06-01" });
    const headerProviderResponse = await sendAndParse("/custom/messages?case=header-provider", { "x-target-provider": "anthropic-auto" });

    assert.deepEqual(openaiResponse.body, {
      ok: true,
      provider: "openai-main",
      path: "/v1/responses?case=prefix-openai",
      auth: "Bearer openai-token",
      targetHeader: "",
      requestBody: JSON.stringify({ model: "smoke", messages: [{ role: "user", content: "hello" }] })
    });
    assert.deepEqual(anthropicRouteResponse.body, {
      ok: true,
      provider: "anthropic-route",
      path: "/v1/messages?case=prefix-anthropic",
      auth: "route-token",
      targetHeader: "",
      requestBody: JSON.stringify({ model: "smoke", messages: [{ role: "user", content: "hello" }] })
    });
    assert.deepEqual(anthropicFormatResponse.body, {
      ok: true,
      provider: "anthropic-auto",
      path: "/v1/messages?case=format-anthropic",
      auth: "auto-token",
      targetHeader: "",
      requestBody: JSON.stringify({ model: "smoke", messages: [{ role: "user", content: "hello" }] })
    });
    assert.deepEqual(headerProviderResponse.body, {
      ok: true,
      provider: "anthropic-auto",
      path: "/custom/messages?case=header-provider",
      auth: "auto-token",
      targetHeader: "",
      requestBody: JSON.stringify({ model: "smoke", messages: [{ role: "user", content: "hello" }] })
    });

    assert.deepEqual(hits, [
      { provider: "openai-main", path: "/v1/responses?case=prefix-openai", auth: "Bearer openai-token", targetHeader: "" },
      { provider: "anthropic-route", path: "/v1/messages?case=prefix-anthropic", auth: "route-token", targetHeader: "" },
      { provider: "anthropic-auto", path: "/v1/messages?case=format-anthropic", auth: "auto-token", targetHeader: "" },
      { provider: "anthropic-auto", path: "/custom/messages?case=header-provider", auth: "auto-token", targetHeader: "" }
    ]);
  } finally {
    await started.close();
    started.shutdownLoop();
    await closeServer(openai.server);
    await closeServer(anthropicRoute.server);
    await closeServer(anthropicAuto.server);
    await rm(dir, { recursive: true, force: true });
  }
});
