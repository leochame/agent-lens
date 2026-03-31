import test from "node:test";
import assert from "node:assert/strict";
import { createModelClient } from "./model-client-factory";
import { OpenAIModelClient } from "./openai-model-client";
import { AnthropicModelClient } from "./anthropic-model-client";

test("createModelClient returns OpenAI client for openai provider", () => {
  const client = createModelClient({
    provider: "openai",
    apiKey: "k-openai",
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => "{}" } as Response)
  });
  assert.equal(client instanceof OpenAIModelClient, true);
});

test("createModelClient returns Anthropic client for anthropic provider", () => {
  const client = createModelClient({
    provider: "anthropic",
    apiKey: "k-anthropic",
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => "{}" } as Response)
  });
  assert.equal(client instanceof AnthropicModelClient, true);
});

test("createModelClient throws for unsupported provider at runtime", () => {
  assert.throws(
    () => createModelClient({
      provider: "azure" as unknown as "openai",
      apiKey: "k-invalid"
    }),
    /unsupported model provider: azure/
  );
});
