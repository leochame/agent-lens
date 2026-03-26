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
    assert.equal(removed.error, "task removed from queue");
    const run1 = await p1;
    assert.equal(run1.status, "success");
  } finally {
    await cleanup();
  }
});

test("immediate conflict run is recorded when recordRun is enabled", async () => {
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
    const second = await scheduler.runNow(task.id);
    const done = await first;

    assert.equal(second.status, "failed");
    assert.equal(second.error, "task is already running");
    assert.equal(done.status, "success");
    const runs = scheduler.listRuns(10);
    assert.ok(runs.some((item) => item.error === "task is already running"));
  } finally {
    await cleanup();
  }
});
