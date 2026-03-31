import { ModelChatRequest, ModelChatResponse, ModelClient } from "../../core/model";

type AnthropicModelClientOptions = {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const DEFAULT_MAX_TOKENS = 1024;

function normalizeBaseURL(value: string | undefined): string {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function extractText(body: any): string {
  const content = Array.isArray(body?.content) ? body.content : [];
  const chunks: string[] = [];
  for (const part of content) {
    if (part?.type === "text" && typeof part?.text === "string") {
      chunks.push(part.text);
    }
  }
  return chunks.join("");
}

export class AnthropicModelClient implements ModelClient {
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
    this.baseURL = normalizeBaseURL(options.baseURL ?? process.env.ANTHROPIC_BASE_URL);
    this.defaultModel = String(options.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    const maxTokensRaw = Number(options.maxTokens ?? process.env.ANTHROPIC_MAX_TOKENS ?? DEFAULT_MAX_TOKENS);
    this.defaultMaxTokens = Number.isFinite(maxTokensRaw) && maxTokensRaw > 0
      ? Math.floor(maxTokensRaw)
      : DEFAULT_MAX_TOKENS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(req: ModelChatRequest): Promise<ModelChatResponse> {
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
      text: extractText(body),
      model: typeof body?.model === "string" ? body.model : model,
      usage: {
        inputTokens: typeof body?.usage?.input_tokens === "number" ? body.usage.input_tokens : null,
        outputTokens: typeof body?.usage?.output_tokens === "number" ? body.usage.output_tokens : null
      },
      raw: body
    };
  }
}
