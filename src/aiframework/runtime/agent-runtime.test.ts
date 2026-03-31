import test from "node:test";
import assert from "node:assert/strict";
import { AgentRuntime } from "./agent-runtime";
import { TaskRuntime } from "./task-runtime";

test("agent runtime delegates to task runtime", async () => {
  const calls: string[] = [];
  const taskRuntime = {
    inspectPath: async () => {
      calls.push("inspectPath");
      return { path: "/tmp", kind: "directory" as const, runCwd: "/tmp", promptHint: null };
    },
    validateWorkflowStepPaths: async () => {
      calls.push("validateWorkflowStepPaths");
    },
    resolveExecutionContext: async () => {
      calls.push("resolveExecutionContext");
      return { cwd: "/tmp", prompt: "p" };
    },
    executeTask: async () => {
      calls.push("executeTask");
      return {
        status: "success" as const,
        exitCode: 0,
        error: null,
        stdout: "ok",
        stderr: "",
        firstFailure: null
      };
    },
    executeCommand: async () => {
      calls.push("executeCommand");
      return {
        status: "success" as const,
        exitCode: 0,
        stdout: "cmd",
        stderr: "",
        error: null
      };
    },
    executeModel: async () => {
      calls.push("executeModel");
      return {
        status: "success" as const,
        exitCode: 0,
        stdout: "model",
        stderr: "",
        error: null
      };
    },
    executeTool: async () => {
      calls.push("executeTool");
      return {
        success: true,
        output: "tool",
        error: null
      };
    }
  } as unknown as TaskRuntime;

  const runtime = new AgentRuntime({ taskRuntime });

  const inspected = await runtime.inspectPath("/tmp");
  assert.equal(inspected.runCwd, "/tmp");

  await runtime.validateWorkflowStepPaths([{ name: "step-1", cwd: "/tmp" }], null);

  const context = await runtime.resolveExecutionContext(null, "p");
  assert.equal(context.cwd, "/tmp");

  const result = await runtime.executeTask({
    task: {
      id: "task-1",
      runner: "custom",
      prompt: "p",
      command: null,
      workflowSteps: [{ name: "step-1" }],
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
    }
  });
  assert.equal(result.status, "success");

  const cmd = await runtime.executeCommand("echo 1", "/tmp", 1);
  assert.equal(cmd.status, "success");

  const model = await runtime.executeModel("openai", "hi", "/tmp");
  assert.equal(model.status, "success");

  const tool = await runtime.executeTool({ name: "echo", cwd: "/tmp", input: { msg: "hi" } });
  assert.equal(tool.success, true);

  assert.deepEqual(calls, [
    "inspectPath",
    "validateWorkflowStepPaths",
    "resolveExecutionContext",
    "executeTask",
    "executeCommand",
    "executeModel",
    "executeTool"
  ]);
});

test("agent runtime injects execution overrides into executeTask request", async () => {
  let seenRunCommand: unknown = null;
  let seenRunModel: unknown = null;
  let seenRunTool: unknown = null;
  let seenResolveStepContext: unknown = null;

  const taskRuntime = {
    executeTask: async (req: {
      runCommand?: unknown;
      runModel?: unknown;
      runTool?: unknown;
      resolveStepContext?: unknown;
    }) => {
      seenRunCommand = req.runCommand ?? null;
      seenRunModel = req.runModel ?? null;
      seenRunTool = req.runTool ?? null;
      seenResolveStepContext = req.resolveStepContext ?? null;
      return {
        status: "success" as const,
        exitCode: 0,
        error: null,
        stdout: "ok",
        stderr: "",
        firstFailure: null
      };
    }
  } as unknown as TaskRuntime;

  const runtime = new AgentRuntime({ taskRuntime });
  runtime.setExecutionOverrides({
    runCommand: async () => ({ status: "success", exitCode: 0, stdout: "", stderr: "", error: null }),
    runModel: async () => ({ status: "success", exitCode: 0, stdout: "", stderr: "", error: null }),
    runTool: async () => ({ success: true, output: "ok", error: null }),
    resolveStepContext: async (cwdInput, prompt, baseCwd) => ({ cwd: baseCwd || cwdInput || process.cwd(), prompt })
  });

  await runtime.executeTask({
    task: {
      id: "task-1",
      runner: "custom",
      prompt: "p",
      command: null,
      workflowSteps: [{ name: "step-1" }],
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
    }
  });

  assert.ok(seenRunCommand);
  assert.ok(seenRunModel);
  assert.ok(seenRunTool);
  assert.ok(seenResolveStepContext);

  runtime.clearExecutionOverrides();
  await runtime.executeTask({
    task: {
      id: "task-2",
      runner: "custom",
      prompt: "p",
      command: null,
      workflowSteps: [{ name: "step-1" }],
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
    }
  });

  assert.equal(seenRunCommand, null);
  assert.equal(seenRunModel, null);
  assert.equal(seenRunTool, null);
  assert.equal(seenResolveStepContext, null);
});
