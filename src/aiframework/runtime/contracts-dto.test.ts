import test from "node:test";
import assert from "node:assert/strict";
import type {
  RuntimeAgentRuntimeExecutionOverrides,
  RuntimeCommandExecutionResult,
  RuntimeModelProvider,
  RuntimeToolCall,
  RuntimeToolResult,
  RuntimeTaskRuntimeExecutionRequest,
  TaskRuntimeExecutionRequest,
  WorkflowRunner,
  WorkflowStepInput
} from "./contracts";

test("runtime execution request DTO stays scheduler-friendly and alias-compatible", () => {
  const step: WorkflowStepInput = {
    name: "step-1",
    runner: "custom"
  };
  const runner: WorkflowRunner = "custom";

  const overrides: RuntimeAgentRuntimeExecutionOverrides = {
    runCommand: async () => ({ status: "success", exitCode: 0, stdout: "", stderr: "", error: null }),
    runModel: async () => ({ status: "success", exitCode: 0, stdout: "", stderr: "", error: null }),
    runTool: async () => ({ success: true, output: "", error: null }),
    resolveStepContext: async (_cwdInput, prompt, baseCwd) => ({ cwd: baseCwd, prompt })
  };

  const req: RuntimeTaskRuntimeExecutionRequest = {
    task: {
      id: "task-1",
      runner,
      prompt: "p",
      command: null,
      workflowSteps: [step],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      workflowSharedSession: false,
      workflowFullAccess: false
    },
    cwdInput: null,
    initialStepIndex: 0,
    callbacks: {
      onEvent: () => {},
      onStepChange: () => {},
      onOutput: () => {},
      onHeartbeat: () => {},
      isCancelled: () => null,
      stopAfterRoundReason: () => null
    },
    ...overrides
  };

  const aliasReq: TaskRuntimeExecutionRequest = req;
  assert.equal(aliasReq.task.id, "task-1");
  assert.equal(aliasReq.task.workflowSteps[0].name, "step-1");
});

test("runtime DTOs remain self-contained and structurally usable", () => {
  const provider: RuntimeModelProvider = "openai";
  const call: RuntimeToolCall = { name: "echo", cwd: "/tmp", stepName: "s1", input: { text: "hello" } };
  const toolResult: RuntimeToolResult = { success: true, output: "ok", error: null };
  const commandResult: RuntimeCommandExecutionResult = {
    status: "success",
    exitCode: 0,
    stdout: "ok",
    stderr: "",
    error: null
  };

  assert.equal(provider, "openai");
  assert.equal(call.name, "echo");
  assert.equal(toolResult.success, true);
  assert.equal(commandResult.status, "success");
});
