import { dirname, join, parse } from "node:path";

export type ApiFormat = "openai" | "anthropic" | "unknown";

function sanitizeSegment(input: string): string {
  const s = String(input || "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "unknown";
}

export function archiveRootFromLogFile(filePath: string): string {
  const parsed = parse(filePath);
  return join(dirname(filePath), `${parsed.name}.archive`);
}

export function archiveRecordFilePath(
  filePath: string,
  _sessionId: string | null,
  requestId: string,
  type: "request" | "response",
  apiFormat: ApiFormat = "unknown"
): string {
  const root = archiveRootFromLogFile(filePath);
  const formatPart = sanitizeSegment(apiFormat);
  const requestPart = sanitizeSegment(requestId);
  return join(root, "by-format", formatPart, "by-request", requestPart, `${type}.json`);
}

export function legacyArchiveByRequestFilePath(
  filePath: string,
  requestId: string,
  type: "request" | "response"
): string {
  const root = archiveRootFromLogFile(filePath);
  const requestPart = sanitizeSegment(requestId);
  return join(root, "by-request", requestPart, `${type}.json`);
}

export function legacyArchiveRecordFilePath(
  filePath: string,
  sessionId: string | null,
  requestId: string,
  type: "request" | "response"
): string {
  const root = archiveRootFromLogFile(filePath);
  const sessionPart = sanitizeSegment(sessionId || "no-session");
  const requestPart = sanitizeSegment(requestId);
  return join(root, sessionPart, `${requestPart}.${type}.json`);
}
