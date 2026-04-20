import { IncomingMessage } from "node:http";
import { URL } from "node:url";
import { AppConfig, RouteRule, RoutingDecision } from "./types";

function rewritePath(pathWithQuery: string, from: string, to: string): string {
  const [pathname, ...queryParts] = pathWithQuery.split("?");
  const query = queryParts.length > 0 ? `?${queryParts.join("?")}` : "";

  if (pathname === from) {
    return `${to}${query}`;
  }
  if (pathname.startsWith(`${from}/`)) {
    return `${to}${pathname.slice(from.length)}${query}`;
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

function routeMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function findRouteRule(config: AppConfig, req: IncomingMessage): RouteRule | null {
  const routes = Array.isArray(config.routing.routes) ? config.routing.routes : [];
  if (routes.length === 0) {
    return null;
  }
  const reqUrl = req.url ?? "/";
  const pathname = reqUrl.split("?")[0] || "/";
  let winner: RouteRule | null = null;
  for (const route of routes) {
    if (!routeMatches(pathname, route.pathPrefix)) {
      continue;
    }
    if (!config.providers[route.provider]) {
      continue;
    }
    if (!winner || route.pathPrefix.length > winner.pathPrefix.length) {
      winner = route;
    }
  }
  return winner;
}

function stripRoutePrefix(pathWithQuery: string, prefix: string): string {
  const [pathname, ...queryParts] = pathWithQuery.split("?");
  const query = queryParts.length > 0 ? `?${queryParts.join("?")}` : "";
  if (pathname === prefix) {
    return `/${query}`;
  }
  if (pathname.startsWith(`${prefix}/`)) {
    return `${pathname.slice(prefix.length)}${query}`;
  }
  return pathWithQuery;
}

function selectProviderName(config: AppConfig, req: IncomingMessage): string {
  const route = findRouteRule(config, req);
  if (route) {
    return route.provider;
  }

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
  const route = findRouteRule(config, req);
  const providerName = selectProviderName(config, req);
  const provider = config.providers[providerName];
  if (!provider) {
    throw new Error(`Provider not found: ${providerName}`);
  }

  const rawPath = req.url ?? "/";
  const targetPathWithQuery = route
    ? route.stripPrefix
      ? stripRoutePrefix(rawPath, route.pathPrefix)
      : rawPath
    : applyPathRewrite(rawPath, provider.pathRewrite);

  try {
    new URL(provider.baseURL);
  } catch {
    throw new Error(`Invalid provider baseURL: ${provider.baseURL}`);
  }

  return {
    providerName,
    provider,
    apiFormat: route?.apiFormat ?? "unknown",
    targetPathWithQuery
  };
}
