import { loadConfig, resolveConfigPath } from "./router/config/config";
import { startServer } from "./router/proxy/server";

function describeStartupError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const code = "code" in error ? String((error as NodeJS.ErrnoException).code || "") : "";
  if (code === "EADDRINUSE") {
    return `${error.message}. Try changing listen.port in config/default.yaml, or start with AGENTLENS_PORT=5291 npm start.`;
  }
  if (code === "EACCES" || code === "EPERM") {
    return `${error.message}. Check host/port permissions and whether your environment allows binding that address.`;
  }
  return error.message;
}

async function main(): Promise<void> {
  const configPath = resolveConfigPath();
  const config = loadConfig();
  const runtime = await startServer(config, configPath);
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`[agent-lens] received ${signal}, shutting down...`);
    runtime.shutdownLoop();
    void runtime.close().finally(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main().catch((error) => {
  console.error(`[agent-lens] startup failed: ${describeStartupError(error)}`);
  process.exit(1);
});
