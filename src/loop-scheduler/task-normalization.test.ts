import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureValidNumericPatch,
  ensureWorkflowHasEnabledSteps,
  ensureWorkflowList,
  ensureWorkflowSteps,
  isWorkflowDefinitionEqual,
  normalizeLoadedTask,
  normalizeOptionalPositiveInt,
  normalizeTaskInput,
  parseOptionalBoolean
} from "./task-normalization";
import { LoopTask } from "./types";

test("task-normalization: boolean and numeric normalization", () => {
  assert.equal(parseOptionalBoolean("yes"), true);
  assert.equal(parseOptionalBoolean("off"), false);
  assert.equal(parseOptionalBoolean("x"), undefined);
  assert.equal(normalizeOptionalPositiveInt(2.9), 2);
  assert.equal(normalizeOptionalPositiveInt(0), null);
});

test("task-normalization: input normalization and numeric guard", () => {
  const normalized = normalizeTaskInput({
    name: "  n  ",
    prompt: "  p  ",
    runner: "custom",
    workflow: "a\n\n b",
    workflowSteps: "s1\ns2",
    intervalSec: 10,
    enabled: "true" as unknown as boolean,
    cwd: "  /tmp  ",
    command: "  echo  "
  });
  assert.equal(normalized.name, "n");
  assert.equal(normalized.prompt, "p");
  assert.deepEqual(normalized.workflow, ["a", "b"]);
  assert.equal(normalized.workflowSteps?.length, 2);
  assert.equal(normalized.enabled, true);
  assert.equal(normalized.cwd, "/tmp");
  assert.equal(normalized.command, "echo");

  assert.throws(() => ensureValidNumericPatch({ intervalSec: 1 } as never, {}), /intervalSec must be a number between 5 and 86400/);
});

test("task-normalization: workflow steps and diff equality", () => {
  const list = ensureWorkflowList("a\n b ");
  assert.deepEqual(list, ["a", "b"]);

  const fromText = ensureWorkflowSteps("s1\ns2", []);
  assert.equal(fromText[0].enabled, true);

  const fromObj = ensureWorkflowSteps([
    { name: " step ", enabled: "1" as unknown as boolean, continueOnError: "0" as unknown as boolean, tool: { name: " t " } }
  ], []);
  assert.equal(fromObj[0].name, "step");
  assert.equal(fromObj[0].tool?.name, "t");

  assert.throws(() => ensureWorkflowHasEnabledSteps([]), /workflow requires at least one step/);
  assert.throws(() => ensureWorkflowHasEnabledSteps([{ name: "x", enabled: false }]), /workflow must have at least one enabled step/);

  const equal = isWorkflowDefinitionEqual(["a"], [{ name: "s", enabled: true }], ["a"], [{ name: "s", enabled: true }]);
  const different = isWorkflowDefinitionEqual(["a"], [{ name: "s", enabled: true }], ["a"], [{ name: "s", enabled: false }]);
  assert.equal(equal, true);
  assert.equal(different, false);
});

test("task-normalization: normalizeLoadedTask repairs legacy shape", () => {
  const loaded = normalizeLoadedTask({
    id: "1",
    name: "n",
    runner: "unknown" as unknown as "custom",
    prompt: "p",
    workflow: ["a"],
    workflowSteps: [{ name: "s", enabled: true }],
    workflowCarryContext: false,
    workflowLoopFromStart: false,
    workflowSharedSession: true,
    workflowFullAccess: false,
    workflowResumeStepIndex: 0,
    workflowResumeUpdatedAt: "bad",
    workflowResumeReason: "",
    intervalSec: 1,
    timeoutSec: 66,
    enabled: true,
    cwd: "  ",
    command: " c ",
    createdAt: "bad-date",
    updatedAt: "bad-date",
    lastRunAt: "",
  } as LoopTask);

  assert.equal(loaded.runner, "custom");
  assert.equal(loaded.intervalSec, 5);
  assert.equal(loaded.timeoutSec, 0);
  assert.equal(loaded.workflowResumeStepIndex, null);
  assert.equal(loaded.workflowResumeUpdatedAt, null);
  assert.equal(loaded.workflowResumeReason, null);
  assert.equal(loaded.cwd, null);
  assert.equal(loaded.command, "c");
  assert.equal(typeof loaded.createdAt, "string");
});
