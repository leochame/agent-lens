import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopScheduler } from "./engine";

test("run still resolves and releases slot when save fails", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-test-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const task = await scheduler.createTask({
      name: "persist-fail",
      runner: "custom",
      prompt: "run",
      command: 'node -e "process.exit(0)"',
      intervalSec: 300
    });

    const store = (scheduler as unknown as { store: { save: (items: unknown) => Promise<void> } }).store;
    const originalSave = store.save.bind(store);
    let failedOnce = false;
    store.save = async (items: unknown): Promise<void> => {
      if (!failedOnce) {
        failedOnce = true;
        throw new Error("disk full");
      }
      await originalSave(items);
    };

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.match(run.stderr, /persist\] save failed: disk full/);
    assert.equal(scheduler.getSettings().runningCount, 0);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("run resolves and releases slot when unexpected execution error happens", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-test-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const task = await scheduler.createTask({
      name: "unexpected-error",
      runner: "custom",
      prompt: "run",
      command: 'echo "{prompt}"',
      intervalSec: 300
    });

    const executionOverrides = {
      runCommand: async () => {
        throw new Error("boom");
      }
    };

    const run = await scheduler.runNow(task.id, { executionOverrides });
    assert.equal(run.status, "failed");
    assert.match(String(run.error || ""), /unexpected scheduler error: boom/);
    assert.equal(scheduler.getSettings().runningCount, 0);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});
