import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./server";
import { AppConfig } from "../provider/types";

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
