import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { AppConfig, AuthMode } from "../provider/types";
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

const ENV_PLACEHOLDER_RE = /^\$\{([A-Z0-9_]+)(:-([^}]*))?\}$/i;

type InjectAuthMode = Exclude<AuthMode, "passthrough">;
type InjectAuthModeWithTemplate = InjectAuthMode & {
  valueTemplate?: string;
};

function isInjectAuthMode(value: unknown): value is InjectAuthMode {
  return Boolean(value && typeof value === "object" && (value as { type?: string }).type === "inject");
}

function resolveOneEnvPlaceholder(raw: string): string | undefined {
  const m = raw.match(ENV_PLACEHOLDER_RE);
  if (!m) {
    return undefined;
  }
  const key = m[1];
  const fallback = m[3] ?? "";
  return process.env[key] ?? fallback;
}

function resolveEnvPlaceholders(value: unknown): unknown {
  if (typeof value === "string") {
    return resolveOneEnvPlaceholder(value) ?? value;
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

export function resolveLogFilePath(configPath: string, filePath: string): string {
  return resolve(dirname(configPath), filePath);
}

function attachEnvAuthMetadata(raw: AppConfig, resolved: AppConfig): void {
  for (const [name, rawProvider] of Object.entries(raw.providers ?? {})) {
    const resolvedProvider = resolved.providers?.[name];
    if (!resolvedProvider) {
      continue;
    }
    const rawAuth = rawProvider.authMode;
    const resolvedAuth = resolvedProvider.authMode;
    if (!isInjectAuthMode(rawAuth) || !isInjectAuthMode(resolvedAuth)) {
      continue;
    }
    const rawValue = rawAuth.value;
    const match = typeof rawValue === "string" ? rawValue.match(ENV_PLACEHOLDER_RE) : null;
    if (!match) {
      continue;
    }
    resolvedAuth.valueFromEnv = match[1];
    (resolvedAuth as InjectAuthModeWithTemplate).valueTemplate = rawValue;
  }
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
  attachEnvAuthMetadata(raw, resolved);
  const listenPortFromEnv = process.env.AGENTLENS_PORT ?? process.env.PORT;
  const listenHostFromEnv = process.env.AGENTLENS_HOST;

  if (listenHostFromEnv) {
    resolved.listen.host = listenHostFromEnv;
  }
  if (listenPortFromEnv) {
    const port = Number(listenPortFromEnv);
    if (Number.isInteger(port)) {
      resolved.listen.port = port;
    }
  }

  const timeoutFromEnv = process.env.API_TIMEOUT_MS;
  const timeoutFromConfig = resolved.requestTimeoutMs;
  const timeoutFromConfigNumber =
    typeof timeoutFromConfig === "number"
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

  resolved.requestTimeoutMs = Number.isFinite(normalizedTimeout) ? normalizedTimeout : 120000;

  const logging = (resolved.logging && typeof resolved.logging === "object"
    ? resolved.logging
    : {}) as AppConfig["logging"];
  resolved.logging = logging;
  const archiveFromConfig = logging.archiveRequests as unknown;
  logging.archiveRequests =
    typeof archiveFromConfig === "boolean"
      ? archiveFromConfig
      : typeof archiveFromConfig === "string"
        ? archiveFromConfig.toLowerCase() === "true"
        : false;

  return validateConfig(resolved);
}

export async function saveConfig(configPath: string, config: AppConfig): Promise<void> {
  validateConfig(config);

  // Deep clone so helper metadata cleanup does not mutate the caller's live config.
  const forYaml = structuredClone(config) as AppConfig;

  for (const provider of Object.values(forYaml.providers)) {
    if (!isInjectAuthMode(provider.authMode)) {
      continue;
    }
    const authMode = provider.authMode as InjectAuthModeWithTemplate;
    if (typeof authMode.valueTemplate === "string" && ENV_PLACEHOLDER_RE.test(authMode.valueTemplate)) {
      authMode.value = authMode.valueTemplate;
      delete authMode.valueFromEnv;
    }
    delete authMode.valueTemplate;
  }

  const yaml = stringify(forYaml);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, yaml, "utf8");
}
