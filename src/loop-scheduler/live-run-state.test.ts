import test from "node:test";
import assert from "node:assert/strict";
import { LiveRunState } from "./live-run-state";
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

test("LiveRunState keeps tail/event limits and trims list payload", () => {
  const state = new LiveRunState();
  const task = createTask();
  state.init("run-1", task, "manual", new Date(Date.now() - 45_000).toISOString());

  for (let i = 0; i < 130; i += 1) {
    state.pushEvent("run-1", "info", `e-${i}`);
  }
  state.setPhase("run-1", "running");
  state.setStep("run-1", 2, 1, 3, "step");
  state.appendOutput("run-1", "stdout", "a".repeat(6000));
  state.appendOutput("run-1", "stderr", "b".repeat(6000));

  const list = state.list(5);
  assert.equal(list.length, 1);
  assert.equal(list[0].phase, "running");
  assert.equal(list[0].round, 2);
  assert.equal(list[0].events.length, 40);
  assert.equal(list[0].events[0].message, "e-90");
  assert.equal(list[0].stdoutTail.length, 5000);
  assert.equal(list[0].stderrTail.length, 5000);
});

test("LiveRunState clear removes run", () => {
  const state = new LiveRunState();
  const task = createTask();
  state.init("run-1", task, "manual", new Date().toISOString());
  assert.equal(state.list(10).length, 1);
  state.clear("run-1");
  assert.equal(state.list(10).length, 0);
});
