import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIModelClient } from "./openai-model-client";

function mockResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  } as Response;
}

test("OpenAIModelClient sends request and parses output_text", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new OpenAIModelClient({
    apiKey: "k",
    baseURL: "https://mock.openai.local/",
    model: "gpt-x",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return mockResponse(200, JSON.stringify({
        model: "gpt-x",
        output_text: "hello",
        usage: { input_tokens: 11, output_tokens: 7 }
      }));
    }
  });

  const out = await client.chat({ prompt: "hi" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://mock.openai.local/v1/responses");
  assert.match(String(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>).authorization), /^Bearer /);
  assert.equal(out.text, "hello");
  assert.equal(out.usage.inputTokens, 11);
  assert.equal(out.usage.outputTokens, 7);
});

test("OpenAIModelClient throws for non-2xx responses", async () => {
  const client = new OpenAIModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(401, "unauthorized")
  });
  await assert.rejects(client.chat({ prompt: "hi" }), /openai request failed \(401\)/);
});

test("OpenAIModelClient validates prompt and key", async () => {
  assert.throws(() => new OpenAIModelClient({ apiKey: "" }), /OPENAI_API_KEY is required/);
  const client = new OpenAIModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(200, "{}")
  });
  await assert.rejects(client.chat({ prompt: "   " }), /prompt is required/);
});

test("OpenAIModelClient throws on invalid JSON body", async () => {
  const client = new OpenAIModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(200, "{bad json")
  });
  await assert.rejects(client.chat({ prompt: "ok" }), /openai response is not valid JSON/);
});

test("OpenAIModelClient can parse text from output content fallback", async () => {
  const client = new OpenAIModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(200, JSON.stringify({
      output: [{ content: [{ text: "fallback-text" }] }]
    }))
  });
  const out = await client.chat({ prompt: "ok" });
  assert.equal(out.text, "fallback-text");
});

test("OpenAIModelClient concatenates all text parts from output content", async () => {
  const client = new OpenAIModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(200, JSON.stringify({
      output: [
        { content: [{ text: "part-1 " }, { text: "part-2" }] },
        { content: [{ type: "tool_call" }, { text: " part-3" }] }
      ]
    }))
  });
  const out = await client.chat({ prompt: "ok" });
  assert.equal(out.text, "part-1 part-2 part-3");
});

test("OpenAIModelClient returns empty text when output has no text item", async () => {
  const client = new OpenAIModelClient({
    apiKey: "k",
    fetchImpl: async () => mockResponse(200, JSON.stringify({
      output: [{ content: [{ type: "tool_call" }] }]
    }))
  });
  const out = await client.chat({ prompt: "ok" });
  assert.equal(out.text, "");
});
