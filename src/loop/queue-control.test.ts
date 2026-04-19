import test from "node:test";
import assert from "node:assert/strict";
import { createImmediateRun, findQueuedRunByTaskId, shouldSilentlySkipTimerConflict } from "./queue-control";
import { LoopTask } from "./types";

function createTask(): LoopTask {
  const now = new Date().toISOString();
  return {
    id: "task-1",
    name: "task",
    runner: "custom",
    prompt: "p",
    workflow: [],
    workflowSteps: [{ name: "s", enabled: true, continueOnError: false, retryCount: 0, retryBackoffMs: 1000 }],
    workflowCarryContext: false,
    workflowLoopFromStart: false,
    workflowSharedSession: true,
    workflowFullAccess: false,
    workflowResumeStepIndex: null,
    workflowResumeUpdatedAt: null,
    workflowResumeReason: null,
    intervalSec: 300,
    timeoutSec: 0,
    enabled: true,
    cwd: null,
    command: null,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null
  };
}

test("queue-control conflict predicates and lookups", () => {
  assert.equal(shouldSilentlySkipTimerConflict("timer", false), true);
  assert.equal(shouldSilentlySkipTimerConflict("timer", true), false);
  assert.equal(shouldSilentlySkipTimerConflict("manual", false), false);

  const queue = [{ task: { id: "a" } }, { task: { id: "b" } }];
  assert.deepEqual(findQueuedRunByTaskId(queue, "b"), queue[1]);
  assert.equal(findQueuedRunByTaskId(queue, "x"), undefined);
});

test("createImmediateRun builds zero-duration run shape", () => {
  const now = new Date().toISOString();
  const run = createImmediateRun({
    runId: "run-1",
    now,
    task: createTask(),
    trigger: "manual",
    status: "failed",
    error: "boom"
  });
  assert.equal(run.id, "run-1");
  assert.equal(run.startedAt, now);
  assert.equal(run.endedAt, now);
  assert.equal(run.durationMs, 0);
  assert.equal(run.error, "boom");
});
