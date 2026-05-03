import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { AppConfig } from "../provider/types";
import { validateConfig } from "./schema";

export function resolveConfigPath(cwd = process.cwd()): string {
  return resolve(cwd, "config/default.yaml");
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
