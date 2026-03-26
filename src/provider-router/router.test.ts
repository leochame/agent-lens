import test from "node:test";
import assert from "node:assert/strict";
import { resolveRouting } from "./router";
import { AppConfig } from "./types";

function baseConfig(): AppConfig {
  return {
    listen: { host: "127.0.0.1", port: 5290 },
    routing: {
      defaultProvider: "openai",
      byHeader: "x-provider",
      byPathPrefix: {
        "/anth": "anthropic"
      },
      autoDetectProviderByFormat: true,
      formatProviders: {
        anthropic: "anthropic",
        openai: "openai"
      }
    },
    providers: {
      openai: { baseURL: "https://openai.example.com", pathRewrite: [{ from: "/v1", to: "/api" }] },
      anthropic: { baseURL: "https://anthropic.example.com" }
    },
    logging: { filePath: "logs/requests.log" }
  };
}

function req(url: string, headers: Record<string, string> = {}): { url: string; headers: Record<string, string> } {
  return { url, headers };
}

test("resolveRouting prefers byHeader when provider exists", () => {
  const config = baseConfig();
  const decision = resolveRouting(config, req("/v1/chat/completions", { "x-provider": "anthropic" }) as never);
  assert.equal(decision.providerName, "anthropic");
  assert.equal(decision.targetPathWithQuery, "/v1/chat/completions");
});

test("resolveRouting falls back to path prefix then applies rewrite", () => {
  const config = baseConfig();
  const decision = resolveRouting(config, req("/v1/models?x=1") as never);
  assert.equal(decision.providerName, "openai");
  assert.equal(decision.targetPathWithQuery, "/api/models?x=1");
});

test("resolveRouting auto-detects anthropic format via header", () => {
  const config = baseConfig();
  delete config.routing.byHeader;
  config.routing.byPathPrefix = {};
  const decision = resolveRouting(config, req("/v1/messages", { "anthropic-version": "2023-06-01" }) as never);
  assert.equal(decision.providerName, "anthropic");
});

test("resolveRouting throws for missing provider", () => {
  const config = baseConfig();
  config.routing.defaultProvider = "missing";
  config.routing.autoDetectProviderByFormat = false;
  config.routing.byPathPrefix = {};
  delete config.routing.byHeader;
  assert.throws(
    () => resolveRouting(config, req("/v1/chat/completions") as never),
    /Provider not found: missing/
  );
});

test("resolveRouting throws for invalid provider baseURL", () => {
  const config = baseConfig();
  config.providers.openai.baseURL = "://broken-url";
  assert.throws(
    () => resolveRouting(config, req("/v1/chat/completions") as never),
    /Invalid provider baseURL/
  );
});
