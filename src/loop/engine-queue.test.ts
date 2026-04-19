import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopScheduler } from "./engine";

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("waitFor timeout");
}

async function createScheduler(): Promise<{ scheduler: LoopScheduler; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-test-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  return {
    scheduler,
    cleanup: async () => {
      scheduler.shutdown();
      await rm(dir, { recursive: true, force: true });
    }
  };
}

test("queued task is removed when toggled off", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    scheduler.updateSettings({ maxConcurrentRuns: 1 });
    const t1 = await scheduler.createTask({
      name: "running",
      runner: "custom",
      prompt: "run1",
      command: 'node -e "setTimeout(() => process.exit(0), 250)"',
      intervalSec: 300
    });
    const t2 = await scheduler.createTask({
      name: "queued",
      runner: "custom",
      prompt: "run2",
      command: 'node -e "setTimeout(() => process.exit(0), 250)"',
      intervalSec: 300
    });

    const p1 = scheduler.runNow(t1.id);
    const p2 = scheduler.runNow(t2.id);
    await waitFor(() => scheduler.getSettings().queuedCount >= 1);
    const queued = scheduler.listQueue(10);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].taskId, t2.id);
    assert.equal(queued[0].taskName, t2.name);
    assert.equal(queued[0].trigger, "manual");
    assert.ok(queued[0].waitMs >= 0);
    await scheduler.toggleTask(t2.id);
    const removed = await p2;

    assert.equal(removed.status, "failed");
    assert.equal(removed.error, "task removed from queue");
    const run1 = await p1;
    assert.equal(run1.status, "success");
  } finally {
    await cleanup();
  }
});

test("queued task is removed when updated to disabled", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    scheduler.updateSettings({ maxConcurrentRuns: 1 });
    const t1 = await scheduler.createTask({
      name: "running",
      runner: "custom",
      prompt: "run1",
      command: 'node -e "setTimeout(() => process.exit(0), 250)"',
      intervalSec: 300
    });
    const t2 = await scheduler.createTask({
      name: "queued-by-update",
      runner: "custom",
      prompt: "run2",
      command: 'node -e "setTimeout(() => process.exit(0), 250)"',
      intervalSec: 300
    });

    const p1 = scheduler.runNow(t1.id);
    const p2 = scheduler.runNow(t2.id);
    await waitFor(() => scheduler.getSettings().queuedCount >= 1);
    await scheduler.updateTask(t2.id, { enabled: false });
    const removed = await p2;

    assert.equal(removed.status, "failed");
    assert.equal(removed.error, "task removed from queue");
    const run1 = await p1;
    assert.equal(run1.status, "success");
  } finally {
    await cleanup();
  }
});

test("queued task is removed when deleted", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    scheduler.updateSettings({ maxConcurrentRuns: 1 });
    const t1 = await scheduler.createTask({
      name: "running",
      runner: "custom",
      prompt: "run1",
      command: 'node -e "setTimeout(() => process.exit(0), 250)"',
      intervalSec: 300
    });
    const t2 = await scheduler.createTask({
      name: "queued-delete",
      runner: "custom",
      prompt: "run2",
      command: 'node -e "setTimeout(() => process.exit(0), 250)"',
      intervalSec: 300
    });

    const p1 = scheduler.runNow(t1.id);
    const p2 = scheduler.runNow(t2.id);
    await waitFor(() => scheduler.getSettings().queuedCount >= 1);
    await scheduler.deleteTask(t2.id);
    const removed = await p2;

    assert.equal(removed.status, "failed");
    assert.equal(removed.error, "task deleted");
    const run1 = await p1;
    assert.equal(run1.status, "success");
  } finally {
    await cleanup();
  }
});

test("runNow restarts task when clicked again during running", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    const task = await scheduler.createTask({
      name: "conflict-recorded",
      runner: "custom",
      prompt: "run",
      command: 'node -e "setTimeout(() => process.exit(0), 220)"',
      intervalSec: 300
    });

    const first = scheduler.runNow(task.id);
    await waitFor(() => scheduler.getSettings().runningCount === 1);
    const second = scheduler.runNow(task.id);
    const firstDone = await first;
    const secondDone = await second;

    assert.equal(firstDone.status, "cancelled");
    assert.equal(firstDone.error, "task restarted manually");
    assert.equal(secondDone.status, "success");
    const runs = scheduler.listRuns(10);
    assert.equal(runs.some((item) => item.error === "task is already running"), false);
    assert.ok(runs.some((item) => item.error === "task restarted manually"));
  } finally {
    await cleanup();
  }
});

test("multiple runNow clicks while running are coalesced into one restart run", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    const task = await scheduler.createTask({
      name: "restart-coalesced",
      runner: "custom",
      prompt: "run",
      command: 'node -e "setTimeout(() => process.exit(0), 220)"',
      intervalSec: 300
    });

    const first = scheduler.runNow(task.id);
    await waitFor(() => scheduler.getSettings().runningCount === 1);
    const second = scheduler.runNow(task.id);
    const third = scheduler.runNow(task.id);
    const firstDone = await first;
    const secondDone = await second;
    const thirdDone = await third;

    assert.equal(firstDone.status, "cancelled");
    assert.equal(firstDone.error, "task restarted manually");
    assert.equal(secondDone.status, "success");
    assert.equal(thirdDone.status, "success");
    assert.equal(secondDone.id, thirdDone.id);
  } finally {
    await cleanup();
  }
});

test("stopTask cancels running task", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    const task = await scheduler.createTask({
      name: "running-stop",
      runner: "custom",
      prompt: "run",
      command: 'node -e "setInterval(() => {}, 1000)"',
      intervalSec: 300
    });

    const pending = scheduler.runNow(task.id);
    await waitFor(() => scheduler.getSettings().runningCount === 1);
    const stopInfo = scheduler.stopTask(task.id, "task stopped manually");
    const run = await pending;

    assert.equal(stopInfo.running, true);
    assert.equal(run.status, "cancelled");
    assert.equal(run.error, "task stopped manually");
  } finally {
    await cleanup();
  }
});

test("stop-after-round on non-loop task falls back to immediate stop", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    const task = await scheduler.createTask({
      name: "non-loop-stop-after-round-fallback",
      runner: "custom",
      prompt: "run",
      command: 'node -e "setInterval(() => {}, 1000)"',
      workflowLoopFromStart: false,
      intervalSec: 300
    });

    const pending = scheduler.runNow(task.id);
    await waitFor(() => scheduler.getSettings().runningCount === 1);
    const stopInfo = scheduler.stopTask(task.id, "stop requested after current round", { afterRound: true });
    const run = await pending;

    assert.equal(stopInfo.running, true);
    assert.equal(stopInfo.deferred, false);
    assert.equal(run.status, "cancelled");
    assert.equal(run.error, "stop requested after current round");
  } finally {
    await cleanup();
  }
});

test("deleteTask cancels running task", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    const task = await scheduler.createTask({
      name: "running-delete",
      runner: "custom",
      prompt: "run",
      command: 'node -e "setInterval(() => {}, 1000)"',
      intervalSec: 300
    });

    const pending = scheduler.runNow(task.id);
    await waitFor(() => scheduler.getSettings().runningCount === 1);
    await scheduler.deleteTask(task.id);
    const run = await pending;

    assert.equal(run.status, "cancelled");
    assert.equal(run.error, "task deleted");
    assert.equal(scheduler.listTasks().some((item) => item.id === task.id), false);
  } finally {
    await cleanup();
  }
});

test("stopTask delayed force-kill is skipped after run control is released", async () => {
  const { scheduler, cleanup } = await createScheduler();
  const originalKill = process.kill;
  try {
    const taskId = "fake-task";
    const signals: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    const fakeChild = {
      pid: 43210
    } as any;
    (process as typeof process & {
      kill: (pid: number, signal: NodeJS.Signals) => boolean;
    }).kill = ((pid: number, signal: NodeJS.Signals) => {
      signals.push({ pid, signal });
      return true;
    }) as typeof process.kill;

    (scheduler as any).runningControls.set(taskId, {
      runId: "run-1",
      cancelReason: null,
      stopAfterRoundReason: null,
      child: fakeChild
    });

    const cancelled = (scheduler as any).cancelRunningTask(taskId, "manual stop");
    assert.equal(cancelled, true);
    assert.deepEqual(signals, [{ pid: -43210, signal: "SIGTERM" }]);

    (scheduler as any).runningControls.delete(taskId);
    await new Promise((resolve) => setTimeout(resolve, 2200));

    assert.deepEqual(signals, [{ pid: -43210, signal: "SIGTERM" }]);
  } finally {
    process.kill = originalKill;
    await cleanup();
  }
});

test("request-level execution overrides do not leak across concurrent runs", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    scheduler.updateSettings({ maxConcurrentRuns: 2 });
    const t1 = await scheduler.createTask({
      name: "override-concurrent-1",
      runner: "custom",
      prompt: "run",
      command: 'echo "{prompt}"',
      intervalSec: 300
    });
    const t2 = await scheduler.createTask({
      name: "override-concurrent-2",
      runner: "custom",
      prompt: "run",
      command: 'echo "{prompt}"',
      intervalSec: 300
    });

    const p1 = scheduler.runNow(t1.id, {
      executionOverrides: {
        runCommand: async () => {
          await new Promise((resolve) => setTimeout(resolve, 80));
          return {
            status: "success",
            exitCode: 0,
            stdout: "from-task-1",
            stderr: "",
            error: null
          };
        }
      }
    });
    const p2 = scheduler.runNow(t2.id, {
      executionOverrides: {
        runCommand: async () => ({
          status: "success",
          exitCode: 0,
          stdout: "from-task-2",
          stderr: "",
          error: null
        })
      }
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1.status, "success");
    assert.equal(r2.status, "success");
    assert.match(r1.stdout, /from-task-1/);
    assert.match(r2.stdout, /from-task-2/);
    assert.equal(r1.stdout.includes("from-task-2"), false);
    assert.equal(r2.stdout.includes("from-task-1"), false);
  } finally {
    await cleanup();
  }
});

test("runNow waits until background child releases stdio before resolving", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    const task = await scheduler.createTask({
      name: "background-stdio-open",
      runner: "custom",
      prompt: "run",
      command: 'node -e "setTimeout(() => {}, 2000)" & exit 0',
      intervalSec: 300
    });

    const started = Date.now();
    const run = await scheduler.runNow(task.id);
    const elapsed = Date.now() - started;

    assert.equal(run.status, "success");
    assert.ok(elapsed >= 1800, `run should wait for background stdio to close, got ${elapsed}ms`);
  } finally {
    await cleanup();
  }
});

test("timer conflict is skipped silently without failed run record", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    const task = await scheduler.createTask({
      name: "timer-skip-no-noise",
      runner: "custom",
      prompt: "run",
      command: 'node -e "setTimeout(() => process.exit(0), 300)"',
      intervalSec: 300
    });

    const first = scheduler.runNow(task.id);
    await waitFor(() => scheduler.getSettings().runningCount === 1);
    const taskRef = scheduler.listTasks().find((item) => item.id === task.id);
    assert.ok(taskRef);

    const skipped = await (scheduler as unknown as {
      runTask: (
        taskArg: typeof task,
        trigger: "timer" | "manual",
        options: { persistTaskState: boolean; recordRun: boolean; restartIfRunning?: boolean }
      ) => Promise<{ status: string; error: string | null }>;
    }).runTask(taskRef!, "timer", { persistTaskState: true, recordRun: true });

    assert.equal(skipped.status, "cancelled");
    assert.equal(skipped.error, "task already running (timer skipped)");
    const done = await first;
    assert.equal(done.status, "success");

    const runs = scheduler.listRuns(20);
    assert.equal(runs.some((item) => item.error === "task is already running"), false);
  } finally {
    await cleanup();
  }
});
