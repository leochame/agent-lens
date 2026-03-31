import { LoopRun, LoopTask } from "./types";

export type QueuedRunLookup<TQueuedRun extends { task: { id: string } }> = TQueuedRun[];

export function shouldSilentlySkipTimerConflict(trigger: "timer" | "manual", restartIfRunning?: boolean): boolean {
  return trigger === "timer" && !restartIfRunning;
}

export function findQueuedRunByTaskId<TQueuedRun extends { task: { id: string } }>(
  queue: QueuedRunLookup<TQueuedRun>,
  taskId: string
): TQueuedRun | undefined {
  return queue.find((item) => item.task.id === taskId);
}

export function createImmediateRun(params: {
  runId: string;
  now: string;
  task: LoopTask;
  trigger: "timer" | "manual";
  status: LoopRun["status"];
  error: string;
}): LoopRun {
  return {
    id: params.runId,
    taskId: params.task.id,
    taskName: params.task.name,
    runner: params.task.runner,
    trigger: params.trigger,
    startedAt: params.now,
    endedAt: params.now,
    durationMs: 0,
    status: params.status,
    exitCode: null,
    stdout: "",
    stderr: "",
    error: params.error
  };
}
