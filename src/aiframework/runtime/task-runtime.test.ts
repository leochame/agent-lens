import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CommandExecutionResult,
  CommandRunner,
  WorkflowExecutionRequest,
  WorkflowExecutionResult
} from "./contracts";
import { TaskRuntime } from "./task-runtime";

test("task runtime inspectPath supports directory and file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-task-runtime-path-"));
  const file = join(dir, "note.txt");
  await writeFile(file, "hello", "utf8");

  const runtime = new TaskRuntime();
  try {
    const byDir = await runtime.inspectPath(dir);
    assert.equal(byDir.kind, "directory");
    assert.equal(byDir.runCwd, dir);

    const byFile = await runtime.inspectPath(file);
    assert.equal(byFile.kind, "file");
    assert.equal(byFile.runCwd, dir);
    assert.match(String(byFile.promptHint), /Focus file:/);

    await assert.rejects(runtime.inspectPath(""), /path is required/);
    await assert.rejects(runtime.inspectPath(join(dir, "missing.txt")), /path not found:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("task runtime resolveExecutionContext handles file cwd", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-task-runtime-context-"));
  const file = join(dir, "focus.ts");
  await writeFile(file, "const a = 1;", "utf8");

  const runtime = new TaskRuntime();
  try {
    const defaultCtx = await runtime.resolveExecutionContext(null, "  hello world  ");
    assert.equal(defaultCtx.cwd, process.cwd());
    assert.equal(defaultCtx.prompt, "hello world");

    const fileCtx = await runtime.resolveExecutionContext(file, "prompt");
    assert.equal(fileCtx.cwd, dir);
    assert.match(fileCtx.prompt, /Focus file:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("task runtime resolveExecutionContext treats blank cwd as unset", async () => {
  const runtime = new TaskRuntime();
  const ctx = await runtime.resolveExecutionContext("   ", "  hello world  ");
  assert.equal(ctx.cwd, process.cwd());
  assert.equal(ctx.prompt, "hello world");
});

test("task runtime validateWorkflowStepPaths resolves relative paths against task cwd", async () => {
  const base = await mkdtemp(join(tmpdir(), "agent-lens-task-runtime-step-cwd-"));
  await writeFile(join(base, ".keep"), "", "utf8");
  await writeFile(join(base, "child-file.txt"), "", "utf8");

  const runtime = new TaskRuntime();
  try {
    await runtime.validateWorkflowStepPaths(
      [{ name: "step-1", cwd: "child-file.txt" }],
      base
    );

    await assert.rejects(
      runtime.validateWorkflowStepPaths([{ name: "bad-step", cwd: "missing" }], base),
      /workflow step "bad-step" cwd invalid: path not found:/
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("task runtime executeTask emits resolved cwd and delegates to workflow executor", async () => {
  const calls: string[] = [];
  const commandRunner: CommandRunner = {
    run: async (): Promise<CommandExecutionResult> => {
      calls.push("run-command");
      return { status: "success", exitCode: 0, stdout: "ok", stderr: "", error: null };
    }
  };

  let factoryCalls = 0;
  const runtime = new TaskRuntime({
    commandRunner,
    modelClientFactory: ({ provider }) => {
      factoryCalls += 1;
      return {
        chat: async (req) => ({
          text: `${provider}:${req.prompt}`,
          model: provider,
          usage: { inputTokens: 1, outputTokens: 1 },
          raw: null
        })
      };
    },
    toolExecutor: {
      execute: async () => ({
        success: true,
        output: "tool-ok",
        error: null
      })
    },
    workflowExecutor: {
      execute: async (req: WorkflowExecutionRequest): Promise<WorkflowExecutionResult> => {
        assert.equal(req.preparedContext.prompt, "base prompt");
        await req.runCommand("echo hi", req.preparedContext.cwd, 0);
        await req.runModel?.("openai", "hello", req.preparedContext.cwd);
        const toolResult = await req.runTool?.({
          name: "echo",
          input: { message: "hi" },
          cwd: req.preparedContext.cwd
        });
        assert.equal(toolResult?.success, true);
        assert.equal(toolResult?.output, "tool-ok");
        return {
          status: "success",
          exitCode: 0,
          error: null,
          stdout: "done",
          stderr: "",
          firstFailure: null
        };
      }
    } as unknown as import("./workflow-executor").WorkflowExecutor
  });

  const events: string[] = [];
  const result = await runtime.executeTask({
    task: {
      id: "task-1",
      runner: "custom",
      prompt: "base prompt",
      command: 'echo "{prompt}"',
      workflowSteps: [{ name: "step" }],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      workflowSharedSession: false,
      workflowFullAccess: false
    },
    cwdInput: null,
    initialStepIndex: 0,
    callbacks: {
      onEvent: (_level, message) => events.push(message),
      onStepChange: () => {},
      onOutput: () => {},
      onHeartbeat: () => {},
      isCancelled: () => null,
      stopAfterRoundReason: () => null
    }
  });

  assert.equal(result.status, "success");
  assert.equal(calls.length, 1);
  assert.equal(factoryCalls, 1);
  assert.equal(events.some((item) => item.startsWith("resolved execution cwd:")), true);
});

test("task runtime caches model clients and maps model errors", async () => {
  let createCount = 0;
  const runtime = new TaskRuntime({
    modelClientFactory: ({ provider }) => {
      createCount += 1;
      if (provider === "openai") {
        return {
          chat: async () => {
            throw new Error("model boom");
          }
        };
      }
      return {
        chat: async () => ({
          text: "ok",
          model: "anthropic",
          usage: { inputTokens: 1, outputTokens: 1 },
          raw: null
        })
      };
    }
  });

  const a = runtime.getModelClient("anthropic");
  const b = runtime.getModelClient("anthropic");
  assert.equal(a, b);

  const ok = await runtime.executeModel("anthropic", "hi", process.cwd());
  assert.equal(ok.status, "success");

  const failed = await runtime.executeModel("openai", "hi", process.cwd());
  assert.equal(failed.status, "failed");
  assert.match(String(failed.error), /model boom/);
  assert.equal(createCount, 2);
});

test("task runtime loads and saves memory context when workflowCarryContext=true", async () => {
  const events: string[] = [];
  const memoryStore = {
    loadContext: async () => "previous stdout",
    saveRecord: async () => {}
  };

  let seenPrompt = "";
  const runtime = new TaskRuntime({
    memoryStore,
    workflowExecutor: {
      execute: async (req: WorkflowExecutionRequest): Promise<WorkflowExecutionResult> => {
        seenPrompt = req.preparedContext.prompt;
        return {
          status: "success",
          exitCode: 0,
          error: null,
          stdout: "ok",
          stderr: "",
          firstFailure: null
        };
      }
    } as unknown as import("./workflow-executor").WorkflowExecutor
  });

  await runtime.executeTask({
    task: {
      id: "task-memory-1",
      runner: "custom",
      prompt: "base prompt",
      command: 'echo "{prompt}"',
      workflowSteps: [{ name: "step" }],
      workflowCarryContext: true,
      workflowLoopFromStart: false,
      workflowSharedSession: false,
      workflowFullAccess: false
    },
    cwdInput: null,
    initialStepIndex: 0,
    callbacks: {
      onEvent: (_level, message) => events.push(message),
      onStepChange: () => {},
      onOutput: () => {},
      onHeartbeat: () => {},
      isCancelled: () => null,
      stopAfterRoundReason: () => null
    }
  });

  assert.match(seenPrompt, /base prompt/);
  assert.match(seenPrompt, /\[Memory Context\]/);
  assert.match(seenPrompt, /previous stdout/);
  assert.equal(events.includes("loaded memory context for current task"), true);
  assert.equal(events.includes("saved memory context for current task"), true);
});

test("task runtime keeps running when memory load/save fails", async () => {
  const events: string[] = [];
  const memoryStore = {
    loadContext: async () => {
      throw new Error("load boom");
    },
    saveRecord: async () => {
      throw new Error("save boom");
    }
  };

  const runtime = new TaskRuntime({
    memoryStore,
    workflowExecutor: {
      execute: async (): Promise<WorkflowExecutionResult> => ({
        status: "success",
        exitCode: 0,
        error: null,
        stdout: "ok",
        stderr: "",
        firstFailure: null
      })
    } as unknown as import("./workflow-executor").WorkflowExecutor
  });

  const result = await runtime.executeTask({
    task: {
      id: "task-memory-2",
      runner: "custom",
      prompt: "base prompt",
      command: 'echo "{prompt}"',
      workflowSteps: [{ name: "step" }],
      workflowCarryContext: true,
      workflowLoopFromStart: false,
      workflowSharedSession: false,
      workflowFullAccess: false
    },
    cwdInput: null,
    initialStepIndex: 0,
    callbacks: {
      onEvent: (_level, message) => events.push(message),
      onStepChange: () => {},
      onOutput: () => {},
      onHeartbeat: () => {},
      isCancelled: () => null,
      stopAfterRoundReason: () => null
    }
  });

  assert.equal(result.status, "success");
  assert.equal(events.some((item) => item.includes("load memory context failed: load boom")), true);
  assert.equal(events.some((item) => item.includes("save memory context failed: save boom")), true);
});
