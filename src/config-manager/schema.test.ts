import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "./schema";
import { AppConfig } from "../provider-router/types";

function validConfig(): AppConfig {
  return {
    listen: { host: "127.0.0.1", port: 5290 },
    routing: {
      defaultProvider: "openai",
      formatProviders: {
        openai: "openai",
        anthropic: "anthropic"
      }
    },
    providers: {
      openai: { baseURL: "https://api.openai.example" },
      anthropic: { baseURL: "https://api.anthropic.example" }
    },
    logging: { filePath: "logs/requests.log" }
  };
}

test("validateConfig accepts valid config", () => {
  const cfg = validConfig();
  assert.equal(validateConfig(cfg), cfg);
});

test("validateConfig rejects invalid provider URL", () => {
  const cfg = validConfig();
  cfg.providers.openai.baseURL = "://bad";
  assert.throws(() => validateConfig(cfg), /baseURL must be a valid URL/);
});

test("validateConfig rejects format provider not found", () => {
  const cfg = validConfig();
  cfg.routing.formatProviders = { openai: "missing" };
  assert.throws(() => validateConfig(cfg), /formatProviders\.openai must exist/);
});

test("validateConfig rejects invalid port range", () => {
  const cfg = validConfig();
  cfg.listen.port = 0;
  assert.throws(() => validateConfig(cfg), /listen\.port must be between 1 and 65535/);
});

test("validateConfig rejects invalid pathRewrite rules", () => {
  const cfg = validConfig();
  cfg.providers.openai.pathRewrite = [{ from: "v1", to: "/api" }];
  assert.throws(() => validateConfig(cfg), /pathRewrite\[0\]\.from must start with/);
});

test("validateConfig rejects unknown byPathPrefix provider", () => {
  const cfg = validConfig();
  cfg.routing.byPathPrefix = { "/x": "missing-provider" };
  assert.throws(() => validateConfig(cfg), /byPathPrefix provider not found/);
});
