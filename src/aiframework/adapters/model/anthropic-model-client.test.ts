import test from "node:test";
import assert from "node:assert/strict";
import { AnthropicModelClient } from "./anthropic-model-client";

function mockResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  } as Response;
}

test("AnthropicModelClient sends request and parses text content", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new AnthropicModelClient({
    apiKey: "k",
    baseURL: "https://mock.anthropic.local/",
    model: "claude-x",
    maxTokens: 256,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return mockResponse(200, JSON.stringify({
        model: "claude-x",
        content: [{ type: "text", text: "hello" }],
        usage: { input_tokens: 13, output_tokens: 5 }
      }));
    }
  });

  const out = await client.chat({ prompt: "hi" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://mock.anthropic.local/v1/messages");
  const headers = (calls[0].init?.headers || {}) as Record<string, string>;
  assert.equal(headers["anthropic-version"], "2023-06-01");
  assert.equal(out.text, "hello");
  assert.equal(out.usage.inputTokens, 13);
  assert.equal(out.usage.outputTokens, 5);
});

test("AnthropicModelClient throws for non-2xx responses", async () => {
  const client = new AnthropicModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(429, "rate limited")
  });
  await assert.rejects(client.chat({ prompt: "hi" }), /anthropic request failed \(429\)/);
});

test("AnthropicModelClient validates prompt and key", async () => {
  assert.throws(() => new AnthropicModelClient({ apiKey: "" }), /ANTHROPIC_API_KEY is required/);
  const client = new AnthropicModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(200, "{}")
  });
  await assert.rejects(client.chat({ prompt: "" }), /prompt is required/);
});

test("AnthropicModelClient throws on invalid JSON body", async () => {
  const client = new AnthropicModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(200, "{bad json")
  });
  await assert.rejects(client.chat({ prompt: "ok" }), /anthropic response is not valid JSON/);
});

test("AnthropicModelClient returns empty text when message has no text content", async () => {
  const client = new AnthropicModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(200, JSON.stringify({
      content: [{ type: "tool_use", id: "x" }]
    }))
  });
  const out = await client.chat({ prompt: "ok" });
  assert.equal(out.text, "");
});

test("AnthropicModelClient concatenates all text content blocks", async () => {
  const client = new AnthropicModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(200, JSON.stringify({
      content: [
        { type: "text", text: "part-1 " },
        { type: "tool_use", id: "x" },
        { type: "text", text: "part-2" }
      ]
    }))
  });
  const out = await client.chat({ prompt: "ok" });
  assert.equal(out.text, "part-1 part-2");
});
