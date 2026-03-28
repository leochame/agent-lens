import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopScheduler } from "./engine";

async function waitFor(predicate: () => boolean, timeoutMs = 2500): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("waitFor timeout");
}

test("live runs expose in-progress events and are removed after finish", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-live-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    (scheduler as unknown as {
      executeCommand: (
        command: string,
        cwd: string,
        timeoutSec: number,
        envPatch?: Record<string, string>,
        onChunk?: (stream: "stdout" | "stderr", chunk: string) => void
      ) => Promise<{ status: "success"; exitCode: number; stdout: string; stderr: string; error: null }>;
    }).executeCommand = async (_command, _cwd, _timeoutSec, _envPatch, onChunk) => {
      await new Promise((resolve) => {
        setTimeout(() => {
          if (onChunk) {
            onChunk("stdout", "hello from live stream\n");
          }
        }, 180);
        setTimeout(resolve, 620);
      });
      return {
        status: "success",
        exitCode: 0,
        stdout: "step-ok\n",
        stderr: "",
        error: null
      };
    };

    const task = await scheduler.createTask({
      name: "live-run",
      runner: "custom",
      prompt: "live prompt",
      command: 'echo "{prompt}"',
      workflowSteps: [{ name: "step-1", enabled: true }],
      intervalSec: 300,
      timeoutSec: 60
    });

    const pendingRun = scheduler.runNow(task.id);
    await waitFor(() => scheduler.listLiveRuns().length === 1);
    await waitFor(() => {
      const item = scheduler.listLiveRuns()[0];
      return Boolean(item && Array.isArray(item.events) && item.events.length > 0);
    });
    const live = scheduler.listLiveRuns()[0];
    assert.equal(live.taskId, task.id);
    assert.equal(live.phase, "running");
    assert.ok(live.events.length > 0);
    assert.equal(typeof live.silenceSec, "number");
    assert.equal(live.heartbeatStale, false);

    const run = await pendingRun;
    assert.equal(run.status, "success");
    assert.match(run.stdout, /step-ok/);
    assert.equal(scheduler.listLiveRuns().length, 0);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("live run exposes stale heartbeat state when heartbeat is too old", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-live-stale-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    (scheduler as unknown as {
      executeCommand: (
        command: string,
        cwd: string,
        timeoutSec: number
      ) => Promise<{ status: "success"; exitCode: number; stdout: string; stderr: string; error: null }>;
    }).executeCommand = async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok\n",
        stderr: "",
        error: null
      };
    };

    const task = await scheduler.createTask({
      name: "live-stale",
      runner: "custom",
      prompt: "live stale prompt",
      command: 'echo "{prompt}"',
      workflowSteps: [{ name: "step-1", enabled: true }],
      intervalSec: 300
    });

    const pendingRun = scheduler.runNow(task.id);
    await waitFor(() => scheduler.listLiveRuns().length === 1);
    const runId = scheduler.listLiveRuns()[0].id;
    const liveMap = (scheduler as unknown as { liveRuns: Map<string, { heartbeatAt: string }> }).liveRuns;
    const item = liveMap.get(runId);
    assert.ok(item);
    item!.heartbeatAt = new Date(Date.now() - 45_000).toISOString();

    const stale = scheduler.listLiveRuns()[0];
    assert.equal(stale.heartbeatStale, true);
    assert.ok(stale.silenceSec >= 40);

    const run = await pendingRun;
    assert.equal(run.status, "success");
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});
