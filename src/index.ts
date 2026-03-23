import { loadConfig, resolveConfigPath } from "./config-manager/config";
import { startServer } from "./proxy-engine/server";

function main(): void {
  const configPath = resolveConfigPath();
  const config = loadConfig();
  startServer(config, configPath);
}

main();
