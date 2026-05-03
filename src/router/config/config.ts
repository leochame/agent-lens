import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { AppConfig } from "../provider/types";
import { validateConfig } from "./schema";

function loadDotEnv(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function resolveConfigPath(cwd = process.cwd()): string {
  loadDotEnv(resolve(cwd, ".env"));
  return process.env.AGENTLENS_CONFIG
    ? resolve(cwd, process.env.AGENTLENS_CONFIG)
    : resolve(cwd, "config/default.yaml");
}

export function resolveLogFilePath(configPath: string, filePath: string): string {
  return resolve(dirname(configPath), filePath);
}

export function loadConfig(): AppConfig {
  const cwd = process.cwd();
  const configPath = resolveConfigPath(cwd);

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = readFileSync(configPath, "utf8");
  const config = parse(content) as AppConfig;

  const listenHostFromEnv = process.env.AGENTLENS_HOST;
  const listenPortFromEnv = process.env.AGENTLENS_PORT ?? process.env.PORT;
  const timeoutFromEnv = process.env.API_TIMEOUT_MS;

  if (listenHostFromEnv) {
    config.listen.host = listenHostFromEnv;
  }
  if (listenPortFromEnv) {
    const port = Number(listenPortFromEnv);
    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      config.listen.port = port;
    }
  }

  const timeoutFromConfig = config.requestTimeoutMs;
  const timeoutFromConfigNumber = typeof timeoutFromConfig === "number"
    ? timeoutFromConfig
    : typeof timeoutFromConfig === "string"
      ? Number(timeoutFromConfig)
      : undefined;
  const timeoutFromEnvNumber = timeoutFromEnv ? Number(timeoutFromEnv) : undefined;
  const normalizedTimeout = Number.isFinite(timeoutFromConfigNumber)
    ? timeoutFromConfigNumber
    : Number.isFinite(timeoutFromEnvNumber)
      ? timeoutFromEnvNumber
      : 120000;

  config.requestTimeoutMs = Number.isFinite(normalizedTimeout) ? normalizedTimeout : 120000;

  const logging = (config.logging && typeof config.logging === "object")
    ? config.logging
    : {} as AppConfig["logging"];
  config.logging = logging;
  const archiveFromConfig = logging.archiveRequests as unknown;
  logging.archiveRequests =
    typeof archiveFromConfig === "boolean"
      ? archiveFromConfig
      : typeof archiveFromConfig === "string"
        ? archiveFromConfig.toLowerCase() === "true"
        : false;

  const validated = validateConfig(config);

  if ((validated.requestTimeoutMs ?? 0) > 3600000) {
    console.warn(
      `[agent-lens] requestTimeoutMs=${validated.requestTimeoutMs}ms is unusually high; long-lived stuck upstream requests may accumulate`
    );
  }

  return validated;
}

export async function saveConfig(configPath: string, config: AppConfig): Promise<void> {
  validateConfig(config);

  const yaml = stringify(config);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, yaml, "utf8");
}
