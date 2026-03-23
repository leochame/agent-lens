import { AppConfig } from "../provider-router/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid config: ${message}`);
  }
}

export function validateConfig(input: AppConfig): AppConfig {
  assert(input.listen?.host, "listen.host is required");
  assert(Number.isInteger(input.listen?.port), "listen.port must be an integer");
  assert(input.routing?.defaultProvider, "routing.defaultProvider is required");
  assert(input.providers && Object.keys(input.providers).length > 0, "providers is required");
  assert(input.providers[input.routing.defaultProvider], "routing.defaultProvider must exist in providers");
  assert(input.logging?.filePath, "logging.filePath is required");

  const fmt = input.routing.formatProviders;
  if (fmt?.anthropic) {
    assert(input.providers[fmt.anthropic], "routing.formatProviders.anthropic must exist in providers");
  }
  if (fmt?.openai) {
    assert(input.providers[fmt.openai], "routing.formatProviders.openai must exist in providers");
  }

  for (const [name, provider] of Object.entries(input.providers)) {
    assert(provider.baseURL, `providers.${name}.baseURL is required`);
    try {
      new URL(provider.baseURL);
    } catch {
      throw new Error(`Invalid config: providers.${name}.baseURL must be a valid URL`);
    }
  }

  return input;
}
