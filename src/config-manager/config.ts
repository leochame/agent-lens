import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";
import { AppConfig } from "../provider-router/types";
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

function resolveEnvPlaceholders(value: unknown): unknown {
  if (typeof value === "string") {
    const m = value.match(/^\$\{([A-Z0-9_]+)(:-([^}]*))?\}$/i);
    if (m) {
      const key = m[1];
      const fallback = m[3] ?? "";
      return process.env[key] ?? fallback;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveEnvPlaceholders(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveEnvPlaceholders(v);
    }
    return out;
  }
  return value;
}

export function resolveConfigPath(cwd = process.cwd()): string {
  loadDotEnv(resolve(cwd, ".env"));
  return process.env.AGENTLENS_CONFIG
    ? resolve(cwd, process.env.AGENTLENS_CONFIG)
    : resolve(cwd, "config/default.yaml");
}

export function loadConfig(): AppConfig {
  const cwd = process.cwd();
  const configPath = resolveConfigPath(cwd);

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = readFileSync(configPath, "utf8");
  const raw = parse(content) as AppConfig;
  const resolved = resolveEnvPlaceholders(raw) as AppConfig;

  const timeoutFromEnv = process.env.API_TIMEOUT_MS;
  const timeoutFromConfig = resolved.requestTimeoutMs;
  const normalizedTimeout =
    typeof timeoutFromConfig === "number"
      ? timeoutFromConfig
      : typeof timeoutFromConfig === "string"
        ? Number(timeoutFromConfig)
        : timeoutFromEnv
          ? Number(timeoutFromEnv)
          : 120000;

  resolved.requestTimeoutMs = Number.isFinite(normalizedTimeout) ? normalizedTimeout : 120000;

  return validateConfig(resolved);
}

export async function saveConfig(configPath: string, config: AppConfig): Promise<void> {
  const valid = validateConfig(config);
  const yaml = stringify(valid);
  await writeFile(configPath, yaml, "utf8");
}
