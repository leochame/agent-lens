import test from "node:test";
import assert from "node:assert/strict";
import { resolveRouting } from "./router";
import { AppConfig } from "./types";

function baseConfig(): AppConfig {
  return {
    listen: { host: "127.0.0.1", port: 5290 },
    routing: {
      defaultProvider: "openai",
      routes: [
        { pathPrefix: "/v1", provider: "openai", apiFormat: "openai", stripPrefix: true },
        { pathPrefix: "/claude", provider: "anthropic", apiFormat: "anthropic", stripPrefix: true }
      ]
    },
    providers: {
      openai: { baseURL: "https://openai.example.com" },
      anthropic: { baseURL: "https://anthropic.example.com" }
    },
    logging: { filePath: "logs/requests.log" }
  };
}

function req(url: string, headers: Record<string, string> = {}): { url: string; headers: Record<string, string> } {
  return { url, headers };
}

test("resolveRouting strips OpenAI route prefix before forwarding", () => {
  const config = baseConfig();
  const decision = resolveRouting(config, req("/v1/chat/completions?stream=true") as never);
  assert.equal(decision.providerName, "openai");
  assert.equal(decision.apiFormat, "openai");
  assert.equal(decision.targetPathWithQuery, "/chat/completions?stream=true");
});

test("resolveRouting strips OpenAI route prefix for exact prefix matches", () => {
  const config = baseConfig();
  const decision = resolveRouting(config, req("/v1?stream=true") as never);
  assert.equal(decision.providerName, "openai");
  assert.equal(decision.targetPathWithQuery, "/?stream=true");
});

test("resolveRouting strips Claude route prefix before forwarding", () => {
  const config = baseConfig();
  const decision = resolveRouting(config, req("/claude/v1/messages?beta=1") as never);
  assert.equal(decision.providerName, "anthropic");
  assert.equal(decision.apiFormat, "anthropic");
  assert.equal(decision.targetPathWithQuery, "/v1/messages?beta=1");
});

test("resolveRouting strips Claude route prefix for exact prefix matches", () => {
  const config = baseConfig();
  const decision = resolveRouting(config, req("/claude?beta=1") as never);
  assert.equal(decision.providerName, "anthropic");
  assert.equal(decision.targetPathWithQuery, "/?beta=1");
});

test("resolveRouting prefers the longest matching route prefix", () => {
  const config = baseConfig();
  config.routing.routes?.push({ pathPrefix: "/claude/v1", provider: "openai", apiFormat: "openai", stripPrefix: true });
  const decision = resolveRouting(config, req("/claude/v1/models") as never);
  assert.equal(decision.providerName, "openai");
  assert.equal(decision.targetPathWithQuery, "/models");
});

test("resolveRouting throws for missing provider", () => {
  const config = baseConfig();
  config.routing.defaultProvider = "missing";
  config.routing.routes = [];
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
