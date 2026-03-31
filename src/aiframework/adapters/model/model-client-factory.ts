import { ModelClient, ModelProvider } from "../../core/model";
import { AnthropicModelClient } from "./anthropic-model-client";
import { OpenAIModelClient } from "./openai-model-client";

export type ModelClientFactoryOptions = {
  provider: ModelProvider;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
};

export function createModelClient(options: ModelClientFactoryOptions): ModelClient {
  if (options.provider === "openai") {
    return new OpenAIModelClient({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      model: options.model,
      fetchImpl: options.fetchImpl
    });
  }
  if (options.provider === "anthropic") {
    return new AnthropicModelClient({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      model: options.model,
      maxTokens: options.maxTokens,
      fetchImpl: options.fetchImpl
    });
  }
  throw new Error(`unsupported model provider: ${String(options.provider)}`);
}
