import { loadConfig, resolveConfigPath } from "./config-manager/config";
import { startServer } from "./proxy-engine/server";

function main(): void {
  const configPath = resolveConfigPath();
  const config = loadConfig();
  const runtime = startServer(config, configPath);
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

main();
