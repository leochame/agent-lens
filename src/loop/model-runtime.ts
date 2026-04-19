export type LoopModelProvider = "openai" | "anthropic";

export type LoopModelChatRequest = {
  prompt: string;
  model?: string;
};

export type LoopModelChatResponse = {
  text: string;
  model: string | null;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  };
  raw: unknown;
};

export interface LoopModelClient {
  chat(req: LoopModelChatRequest): Promise<LoopModelChatResponse>;
}

type OpenAIModelClientOptions = {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

type AnthropicModelClientOptions = {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
};

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com";
const OPENAI_DEFAULT_MODEL = "gpt-4.1-mini";
const ANTHROPIC_DEFAULT_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_DEFAULT_MODEL = "claude-3-5-haiku-latest";
const ANTHROPIC_DEFAULT_MAX_TOKENS = 1024;

function normalizeBaseURL(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/\/+$/, "");
}

function extractOpenAIOutputText(body: any): string {
  if (typeof body?.output_text === "string") {
    return body.output_text;
  }
  const output = Array.isArray(body?.output) ? body.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("");
}

function extractAnthropicText(body: any): string {
  const content = Array.isArray(body?.content) ? body.content : [];
  const chunks: string[] = [];
  for (const part of content) {
    if (part?.type === "text" && typeof part?.text === "string") {
      chunks.push(part.text);
    }
  }
  return chunks.join("");
}

export class OpenAIModelClient implements LoopModelClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIModelClientOptions = {}) {
    const apiKey = String(options.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }
    this.apiKey = apiKey;
    this.baseURL = normalizeBaseURL(options.baseURL ?? process.env.OPENAI_BASE_URL, OPENAI_DEFAULT_BASE_URL);
    this.defaultModel = String(options.model ?? process.env.OPENAI_MODEL ?? OPENAI_DEFAULT_MODEL).trim() || OPENAI_DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(req: LoopModelChatRequest): Promise<LoopModelChatResponse> {
    const prompt = String(req.prompt ?? "").trim();
    if (!prompt) {
      throw new Error("prompt is required");
    }
    const model = String(req.model ?? this.defaultModel).trim() || this.defaultModel;
    const response = await this.fetchImpl(`${this.baseURL}/v1/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt
      })
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`openai request failed (${response.status}): ${text.slice(0, 240)}`);
    }

    let body: any;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("openai response is not valid JSON");
    }

    return {
      text: extractOpenAIOutputText(body),
      model: typeof body?.model === "string" ? body.model : model,
      usage: {
        inputTokens: typeof body?.usage?.input_tokens === "number" ? body.usage.input_tokens : null,
        outputTokens: typeof body?.usage?.output_tokens === "number" ? body.usage.output_tokens : null
      },
      raw: body
    };
  }
}

export class AnthropicModelClient implements LoopModelClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnthropicModelClientOptions = {}) {
    const apiKey = String(options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required");
    }
    this.apiKey = apiKey;
    this.baseURL = normalizeBaseURL(options.baseURL ?? process.env.ANTHROPIC_BASE_URL, ANTHROPIC_DEFAULT_BASE_URL);
    this.defaultModel = String(options.model ?? process.env.ANTHROPIC_MODEL ?? ANTHROPIC_DEFAULT_MODEL).trim() || ANTHROPIC_DEFAULT_MODEL;
    const maxTokensRaw = Number(options.maxTokens ?? process.env.ANTHROPIC_MAX_TOKENS ?? ANTHROPIC_DEFAULT_MAX_TOKENS);
    this.defaultMaxTokens = Number.isFinite(maxTokensRaw) && maxTokensRaw > 0
      ? Math.floor(maxTokensRaw)
      : ANTHROPIC_DEFAULT_MAX_TOKENS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(req: LoopModelChatRequest): Promise<LoopModelChatResponse> {
    const prompt = String(req.prompt ?? "").trim();
    if (!prompt) {
      throw new Error("prompt is required");
    }
    const model = String(req.model ?? this.defaultModel).trim() || this.defaultModel;
    const response = await this.fetchImpl(`${this.baseURL}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: this.defaultMaxTokens,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`anthropic request failed (${response.status}): ${text.slice(0, 240)}`);
    }

    let body: any;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("anthropic response is not valid JSON");
    }

    return {
      text: extractAnthropicText(body),
      model: typeof body?.model === "string" ? body.model : model,
      usage: {
        inputTokens: typeof body?.usage?.input_tokens === "number" ? body.usage.input_tokens : null,
        outputTokens: typeof body?.usage?.output_tokens === "number" ? body.usage.output_tokens : null
      },
      raw: body
    };
  }
}

export function createLoopModelClient(provider: LoopModelProvider): LoopModelClient {
  if (provider === "openai") {
    return new OpenAIModelClient();
  }
  if (provider === "anthropic") {
    return new AnthropicModelClient();
  }
  throw new Error(`unsupported model provider: ${String(provider)}`);
}
