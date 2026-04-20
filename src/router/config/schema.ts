import { AppConfig } from "../provider/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid config: ${message}`);
  }
}

export function validateConfig(input: AppConfig): AppConfig {
  assert(input.listen?.host, "listen.host is required");
  assert(Number.isInteger(input.listen?.port), "listen.port must be an integer");
  assert(input.listen.port > 0 && input.listen.port <= 65535, "listen.port must be between 1 and 65535");
  assert(input.routing?.defaultProvider, "routing.defaultProvider is required");
  assert(input.providers && Object.keys(input.providers).length > 0, "providers is required");
  assert(input.providers[input.routing.defaultProvider], "routing.defaultProvider must exist in providers");
  assert(input.logging?.filePath, "logging.filePath is required");
  if (input.requestTimeoutMs !== undefined) {
    assert(Number.isFinite(input.requestTimeoutMs), "requestTimeoutMs must be a finite number");
    assert(input.requestTimeoutMs > 0, "requestTimeoutMs must be > 0");
  }
  if (input.logging.maxBodyBytes !== undefined) {
    assert(Number.isFinite(input.logging.maxBodyBytes), "logging.maxBodyBytes must be a finite number");
    assert(input.logging.maxBodyBytes >= 0, "logging.maxBodyBytes must be >= 0");
  }
  if (input.logging.maxArchiveBodyBytes !== undefined) {
    assert(Number.isFinite(input.logging.maxArchiveBodyBytes), "logging.maxArchiveBodyBytes must be a finite number");
    assert(input.logging.maxArchiveBodyBytes >= 0, "logging.maxArchiveBodyBytes must be >= 0");
  }

  const fmt = input.routing.formatProviders;
  if (fmt?.anthropic) {
    assert(input.providers[fmt.anthropic], "routing.formatProviders.anthropic must exist in providers");
  }
  if (fmt?.openai) {
    assert(input.providers[fmt.openai], "routing.formatProviders.openai must exist in providers");
  }
  const routes = input.routing.routes ?? [];
  for (const [idx, route] of routes.entries()) {
    assert(route && typeof route === "object", `routing.routes[${idx}] must be an object`);
    assert(typeof route.pathPrefix === "string" && route.pathPrefix.length > 0, `routing.routes[${idx}].pathPrefix is required`);
    assert(route.pathPrefix.startsWith("/"), `routing.routes[${idx}].pathPrefix must start with '/'`);
    assert(Boolean(input.providers[route.provider]), `routing.routes[${idx}].provider must exist in providers`);
    assert(route.apiFormat === "openai" || route.apiFormat === "anthropic", `routing.routes[${idx}].apiFormat must be openai or anthropic`);
    if (route.stripPrefix !== undefined) {
      assert(typeof route.stripPrefix === "boolean", `routing.routes[${idx}].stripPrefix must be a boolean`);
    }
  }

  for (const [name, provider] of Object.entries(input.providers)) {
    assert(provider.baseURL, `providers.${name}.baseURL is required`);
    try {
      new URL(provider.baseURL);
    } catch {
      throw new Error(`Invalid config: providers.${name}.baseURL must be a valid URL`);
    }
    if (provider.pathRewrite) {
      assert(Array.isArray(provider.pathRewrite), `providers.${name}.pathRewrite must be an array`);
      for (const [idx, rule] of provider.pathRewrite.entries()) {
        assert(rule && typeof rule === "object", `providers.${name}.pathRewrite[${idx}] must be an object`);
        assert(typeof rule.from === "string" && rule.from.length > 0, `providers.${name}.pathRewrite[${idx}].from is required`);
        assert(typeof rule.to === "string", `providers.${name}.pathRewrite[${idx}].to is required`);
        assert(rule.from.startsWith("/"), `providers.${name}.pathRewrite[${idx}].from must start with '/'`);
        assert(rule.to.startsWith("/"), `providers.${name}.pathRewrite[${idx}].to must start with '/'`);
      }
    }
  }

  const pathPrefix = input.routing.byPathPrefix ?? {};
  for (const [prefix, providerName] of Object.entries(pathPrefix)) {
    assert(prefix.startsWith("/"), "routing.byPathPrefix keys must start with '/'");
    assert(Boolean(input.providers[providerName]), `routing.byPathPrefix provider not found: ${providerName}`);
  }

  return input;
}
