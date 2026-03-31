import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { MemoryStore, TaskMemoryRecord } from "../../core/memory";
import { toSafeTaskPathSegment } from "../../core/task-id";

type StoredMemory = {
  taskId: string;
  records: TaskMemoryRecord[];
};

function trimText(value: unknown, maxChars: number): string {
  return String(value ?? "").trim().slice(0, maxChars);
}

export class FileMemoryStore implements MemoryStore {
  private readonly baseDir: string;
  private readonly keepRounds: number;
  private readonly contextChars: number;

  constructor(options?: {
    baseDir?: string;
    keepRounds?: number;
    contextChars?: number;
  }) {
    this.baseDir = options?.baseDir ?? join(process.cwd(), ".agentlens", "memory");
    this.keepRounds = Math.max(1, Math.floor(options?.keepRounds ?? 8));
    this.contextChars = Math.max(400, Math.floor(options?.contextChars ?? 4000));
  }

  async loadContext(taskId: string): Promise<string> {
    const stored = await this.readTaskMemory(taskId);
    if (!stored || stored.records.length === 0) {
      return "";
    }
    const lines: string[] = [];
    for (const item of stored.records.slice(-this.keepRounds)) {
      const statusLine = `[${item.at}] status=${item.result.status}`;
      const errorLine = item.result.error ? `error: ${trimText(item.result.error, 300)}` : "";
      const stdoutLine = item.result.stdout ? `stdout: ${trimText(item.result.stdout, 500)}` : "";
      const stderrLine = item.result.stderr ? `stderr: ${trimText(item.result.stderr, 500)}` : "";
      lines.push([statusLine, errorLine, stdoutLine, stderrLine].filter(Boolean).join("\n"));
    }
    return lines.join("\n\n").slice(-this.contextChars);
  }

  async saveRecord(taskId: string, record: TaskMemoryRecord): Promise<void> {
    const current = await this.readTaskMemory(taskId);
    const nextRecords = [...(current?.records ?? []), record].slice(-this.keepRounds);
    const filePath = this.pathForTask(taskId);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      JSON.stringify({
        taskId,
        records: nextRecords
      } satisfies StoredMemory, null, 2),
      "utf8"
    );
  }

  private pathForTask(taskId: string): string {
    return join(this.baseDir, `${toSafeTaskPathSegment(taskId)}.json`);
  }

  private async readTaskMemory(taskId: string): Promise<StoredMemory | null> {
    const filePath = this.pathForTask(taskId);
    try {
      const content = await readFile(filePath, "utf8");
      const parsed = JSON.parse(content) as Partial<StoredMemory>;
      if (!parsed || !Array.isArray(parsed.records)) {
        return null;
      }
      return {
        taskId,
        records: parsed.records
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            at: String(item.at ?? "").trim(),
            prompt: String(item.prompt ?? "").trim(),
            result: {
              status: item.result?.status === "success"
                || item.result?.status === "failed"
                || item.result?.status === "timeout"
                || item.result?.status === "cancelled"
                ? item.result.status
                : "failed",
              error: item.result?.error == null ? null : String(item.result.error),
              stdout: String(item.result?.stdout ?? ""),
              stderr: String(item.result?.stderr ?? "")
            }
          }))
      };
    } catch {
      return null;
    }
  }
}
