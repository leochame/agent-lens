import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { LoopTask } from "./types";

type TaskStorePayload = {
  tasks: unknown[];
};

function stripTimeoutFields(task: LoopTask): Record<string, unknown> {
  const { timeoutSec: _timeoutSec, ...rest } = task;
  return rest;
}

export class LoopTaskStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<LoopTask[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(content) as TaskStorePayload;
      return Array.isArray(parsed.tasks) ? (parsed.tasks as LoopTask[]) : [];
    } catch {
      return [];
    }
  }

  async save(tasks: LoopTask[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload: TaskStorePayload = {
      tasks: tasks.map(stripTimeoutFields)
    };
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), "utf8");
  }
}
