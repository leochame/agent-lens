import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, resolveConfigPath, resolveLogFilePath, saveConfig } from "./config";
import { AppConfig } from "../provider/types";

test("resolveConfigPath returns config/default.yaml", () => {
  const p = resolveConfigPath("/tmp");
  assert.equal(p, "/tmp/config/default.yaml");
});

test("resolveLogFilePath anchors relative logging paths to the config directory", () => {
  const configPath = "/tmp/agent-lens/config/default.yaml";
  assert.equal(resolveLogFilePath(configPath, "logs/req.log"), "/tmp/agent-lens/config/logs/req.log");
  assert.equal(resolveLogFilePath(configPath, "../logs/req.log"), "/tmp/agent-lens/logs/req.log");
  assert.equal(resolveLogFilePath(configPath, "/var/tmp/req.log"), "/var/tmp/req.log");
});

test("loadConfig parses and validates YAML config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-config-test-"));
  const prevCwd = process.cwd();
  try {
    await mkdir(join(dir, "config"), { recursive: true });
    await writeFile(
      join(dir, "config/default.yaml"),
      [
        "listen:",
        "  host: 127.0.0.1",
        "  port: 5290",
        "routing:",
        "  defaultProvider: openai",
        "providers:",
        "  openai:",
        "    baseURL: https://api.openai.example",
        "    authMode:",
        "      type: inject",
        "      header: Authorization",
        "      value: sk-test-key",
        "logging:",
        "  filePath: logs/req.log",
        "  archiveRequests: true",
        "requestTimeoutMs: 45000"
      ].join("\n"),
      "utf8"
    );

    process.chdir(dir);
    const config = loadConfig();
    assert.equal(config.requestTimeoutMs, 45000);
    assert.equal(config.logging.archiveRequests, true);
    assert.equal(config.listen.host, "127.0.0.1");
    assert.equal(config.listen.port, 5290);
    const authMode = config.providers.openai.authMode;
    assert.ok(authMode && typeof authMode === "object");
    assert.equal(authMode.type, "inject");
    assert.equal(authMode.value, "sk-test-key");
  } finally {
    process.chdir(prevCwd);
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadConfig warns when requestTimeoutMs is unusually high", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-config-test-"));
  const prevCwd = process.cwd();
  const originalWarn = console.warn;
  const warnings: string[] = [];
  try {
    console.warn = (message?: unknown, ...rest: unknown[]) => {
      warnings.push([message, ...rest].map((item) => String(item)).join(" "));
    };
    await mkdir(join(dir, "config"), { recursive: true });
    await writeFile(
      join(dir, "config/default.yaml"),
      [
        "listen:",
        "  host: 127.0.0.1",
        "  port: 5290",
        "routing:",
        "  defaultProvider: openai",
        "providers:",
        "  openai:",
        "    baseURL: https://api.openai.example",
        "logging:",
        "  filePath: logs/req.log",
        "requestTimeoutMs: 120000000"
      ].join("\n"),
      "utf8"
    );
    process.chdir(dir);
    const config = loadConfig();
    assert.equal(config.requestTimeoutMs, 120000000);
    assert.match(warnings.join("\n"), /requestTimeoutMs=120000000ms is unusually high/);
  } finally {
    console.warn = originalWarn;
    process.chdir(prevCwd);
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveConfig writes YAML that can be loaded back", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-config-test-"));
  try {
    const cfg: AppConfig = {
      listen: { host: "127.0.0.1", port: 5290 },
      routing: { defaultProvider: "openai" },
      providers: { openai: { baseURL: "https://api.openai.example" } },
      logging: { filePath: "logs/req.log" },
      requestTimeoutMs: 12345
    };
    const file = join(dir, "saved.yaml");
    await saveConfig(file, cfg);
    const content = await readFile(file, "utf8");
    assert.match(content, /defaultProvider: openai/);
    assert.match(content, /requestTimeoutMs: 12345/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveConfig creates parent directory when missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-config-test-"));
  try {
    const cfg: AppConfig = {
      listen: { host: "127.0.0.1", port: 5290 },
      routing: { defaultProvider: "openai" },
      providers: { openai: { baseURL: "https://api.openai.example" } },
      logging: { filePath: "logs/req.log" }
    };
    const file = join(dir, "nested", "config", "saved.yaml");
    await saveConfig(file, cfg);
    const content = await readFile(file, "utf8");
    assert.match(content, /providers:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveConfig preserves actual API key value", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-config-test-"));
  const prevCwd = process.cwd();
  try {
    await mkdir(join(dir, "config"), { recursive: true });
    const file = join(dir, "config/default.yaml");

    const cfg: AppConfig = {
      listen: { host: "127.0.0.1", port: 5290 },
      routing: { defaultProvider: "openai" },
      providers: {
        openai: {
          baseURL: "https://api.openai.example",
          authMode: {
            type: "inject",
            header: "Authorization",
            value: "sk-my-secret-key-12345",
            valuePrefix: "Bearer "
          }
        }
      },
      logging: { filePath: "logs/req.log" }
    };

    await saveConfig(file, cfg);
    const content = await readFile(file, "utf8");
    assert.match(content, /sk-my-secret-key-12345/);
    assert.doesNotMatch(content, /\$\{.*\}/);
  } finally {
    process.chdir(prevCwd);
    await rm(dir, { recursive: true, force: true });
  }
});
