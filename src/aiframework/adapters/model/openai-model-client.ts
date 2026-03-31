import { ModelChatRequest, ModelChatResponse, ModelClient } from "../../core/model";

type OpenAIModelClientOptions = {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_BASE_URL = "https://api.openai.com";
const DEFAULT_MODEL = "gpt-4.1-mini";

function normalizeBaseURL(value: string | undefined): string {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function extractOutputText(body: any): string {
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

export class OpenAIModelClient implements ModelClient {
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
    this.baseURL = normalizeBaseURL(options.baseURL ?? process.env.OPENAI_BASE_URL);
    this.defaultModel = String(options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(req: ModelChatRequest): Promise<ModelChatResponse> {
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
      text: extractOutputText(body),
      model: typeof body?.model === "string" ? body.model : model,
      usage: {
        inputTokens: typeof body?.usage?.input_tokens === "number" ? body.usage.input_tokens : null,
        outputTokens: typeof body?.usage?.output_tokens === "number" ? body.usage.output_tokens : null
      },
      raw: body
    };
  }
}
