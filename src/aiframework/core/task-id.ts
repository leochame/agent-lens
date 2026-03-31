import { createHash } from "node:crypto";

export function toSafeTaskPathSegment(taskId: string): string {
  const raw = String(taskId ?? "").trim();
  if (!raw) {
    return "task-blank";
  }
  const normalized = raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const readable = (normalized || "task").slice(0, 48);
  const digest = createHash("sha1").update(raw).digest("hex").slice(0, 12);
  return `${readable}-${digest}`;
}
