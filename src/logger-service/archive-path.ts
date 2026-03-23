import { dirname, join, parse } from "node:path";

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
