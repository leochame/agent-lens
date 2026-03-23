import { IncomingHttpHeaders } from "node:http";

function lowerSet(values: string[] | undefined, defaults: string[]): Set<string> {
  const source = values && values.length > 0 ? values : defaults;
  return new Set(source.map((v) => v.toLowerCase()));
}

function redactValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "[REDACTED]";
  }
  return "[REDACTED]";
}

export function redactHeaders(
  headers: IncomingHttpHeaders,
  redactKeys?: string[]
): Record<string, string | string[]> {
  const sensitive = lowerSet(redactKeys, ["authorization", "x-api-key", "cookie", "set-cookie"]);
  const out: Record<string, string | string[]> = {};

  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) {
      continue;
    }
    if (sensitive.has(k.toLowerCase())) {
      out[k] = Array.isArray(v) ? v.map(() => redactValue(v)) : redactValue(v);
      continue;
    }
    out[k] = v;
  }

  return out;
}

function shouldRedactKey(key: string, patterns: Set<string>): boolean {
  const l = key.toLowerCase();
  for (const p of patterns) {
    if (l.includes(p)) {
      return true;
    }
  }
  return false;
}

export function redactJsonBody(input: unknown, redactKeys?: string[]): unknown {
  const patterns = lowerSet(redactKeys, ["token", "password", "secret", "apikey", "api_key"]);

  function walk(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => walk(item));
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (shouldRedactKey(k, patterns)) {
          next[k] = redactValue(v);
          continue;
        }
        next[k] = walk(v);
      }
      return next;
    }
    return value;
  }

  return walk(input);
}
