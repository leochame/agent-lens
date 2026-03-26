import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, resolveConfigPath, saveConfig } from "./config";
import { AppConfig } from "../provider-router/types";

const ENV_KEYS = ["AGENTLENS_CONFIG", "API_TIMEOUT_MS", "OPENAI_KEY"];

function clearEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

test("resolveConfigPath uses AGENTLENS_CONFIG when set", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-config-test-"));
  try {
    clearEnv();
    process.env.AGENTLENS_CONFIG = "config/custom.yaml";
    const p = resolveConfigPath(dir);
    assert.equal(p, join(dir, "config/custom.yaml"));
  } finally {
    clearEnv();
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadConfig resolves env placeholders and normalizes timeout/archive flags", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-config-test-"));
  const prevCwd = process.cwd();
  try {
    clearEnv();
    await mkdir(join(dir, "config"), { recursive: true });
    await writeFile(
      join(dir, ".env"),
      "OPENAI_KEY=from_dotenv\n",
      "utf8"
    );
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
        "      value: ${OPENAI_KEY:-fallback}",
        "logging:",
        "  filePath: logs/req.log",
        "  archiveRequests: \"true\"",
        "requestTimeoutMs: \"45000\""
      ].join("\n"),
      "utf8"
    );

    process.chdir(dir);
    const config = loadConfig();
    assert.equal(config.requestTimeoutMs, 45000);
    assert.equal(config.logging.archiveRequests, true);
    const authMode = config.providers.openai.authMode;
    assert.ok(authMode && typeof authMode === "object");
    assert.equal(authMode.type, "inject");
    assert.equal(authMode.value, "from_dotenv");
  } finally {
    process.chdir(prevCwd);
    clearEnv();
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadConfig falls back to API_TIMEOUT_MS and default when invalid", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-config-test-"));
  const prevCwd = process.cwd();
  try {
    clearEnv();
    process.env.API_TIMEOUT_MS = "90000";
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
        "requestTimeoutMs: invalid"
      ].join("\n"),
      "utf8"
    );
    process.chdir(dir);
    assert.equal(loadConfig().requestTimeoutMs, 90000);

    process.env.API_TIMEOUT_MS = "not-a-number";
    assert.equal(loadConfig().requestTimeoutMs, 120000);
  } finally {
    process.chdir(prevCwd);
    clearEnv();
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
    clearEnv();
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
    clearEnv();
    await rm(dir, { recursive: true, force: true });
  }
});
