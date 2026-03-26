import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { LoopTask } from "./types";

type TaskStorePayload = {
  tasks: LoopTask[];
};

export class LoopTaskStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<LoopTask[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(content) as TaskStorePayload;
      return Array.isArray(parsed.tasks) ? parsed.tasks : [];
    } catch {
      return [];
    }
  }

  async save(tasks: LoopTask[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload: TaskStorePayload = { tasks };
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), "utf8");
  }
}
