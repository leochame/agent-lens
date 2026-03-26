import { IncomingMessage } from "node:http";
import { URL } from "node:url";
import { AppConfig, RoutingDecision } from "./types";

function rewritePath(pathWithQuery: string, from: string, to: string): string {
  if (pathWithQuery === from) {
    return to;
  }
  if (pathWithQuery.startsWith(`${from}/`)) {
    return `${to}${pathWithQuery.slice(from.length)}`;
  }
  return pathWithQuery;
}

function applyPathRewrite(pathWithQuery: string, rules?: { from: string; to: string }[]): string {
  if (!rules || rules.length === 0) {
    return pathWithQuery;
  }

  let current = pathWithQuery;
  for (const rule of rules) {
    current = rewritePath(current, rule.from, rule.to);
  }
  return current;
}

function selectProviderName(config: AppConfig, req: IncomingMessage): string {
  const byHeader = config.routing.byHeader?.toLowerCase();
  const byPathPrefix = config.routing.byPathPrefix ?? {};
  const reqUrl = req.url ?? "/";

  if (byHeader) {
    const v = req.headers[byHeader];
    const chosen = Array.isArray(v) ? v[0] : v;
    if (chosen && config.providers[chosen]) {
      return chosen;
    }
  }

  for (const [prefix, providerName] of Object.entries(byPathPrefix)) {
    if (reqUrl.startsWith(prefix) && config.providers[providerName]) {
      return providerName;
    }
  }

  if (config.routing.autoDetectProviderByFormat) {
    const detected = detectByFormat(config, req);
    if (detected) {
      return detected;
    }
  }

  return config.routing.defaultProvider;
}

function detectByFormat(config: AppConfig, req: IncomingMessage): string | null {
  const reqUrl = req.url ?? "/";
  const path = reqUrl.split("?")[0];
  const hasAnthropicVersion = Boolean(req.headers["anthropic-version"]);

  const anthProvider = config.routing.formatProviders?.anthropic;
  const openaiProvider = config.routing.formatProviders?.openai;

  const anthropicPath = path === "/v1/messages" || path === "/v1/complete";
  if ((hasAnthropicVersion || anthropicPath) && anthProvider && config.providers[anthProvider]) {
    return anthProvider;
  }

  const openaiPaths = [
    "/v1/responses",
    "/responses",
    "/v1/chat/completions",
    "/chat/completions",
    "/v1/completions",
    "/completions",
    "/v1/embeddings",
    "/embeddings",
    "/v1/images",
    "/images",
    "/v1/audio",
    "/audio",
    "/v1/moderations",
    "/moderations",
    "/v1/fine_tuning",
    "/fine_tuning"
  ];
  if (openaiPaths.some((p) => path.startsWith(p)) && openaiProvider && config.providers[openaiProvider]) {
    return openaiProvider;
  }

  return null;
}

export function resolveRouting(config: AppConfig, req: IncomingMessage): RoutingDecision {
  const providerName = selectProviderName(config, req);
  const provider = config.providers[providerName];
  if (!provider) {
    throw new Error(`Provider not found: ${providerName}`);
  }

  const rawPath = req.url ?? "/";
  const targetPathWithQuery = applyPathRewrite(rawPath, provider.pathRewrite);

  try {
    new URL(provider.baseURL);
  } catch {
    throw new Error(`Invalid provider baseURL: ${provider.baseURL}`);
  }

  return {
    providerName,
    provider,
    targetPathWithQuery
  };
}
