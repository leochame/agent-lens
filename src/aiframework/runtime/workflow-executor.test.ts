import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { WorkflowExecutor } from "./workflow-executor";
import { CommandExecutionResult, WorkflowExecutionCallbacks, WorkflowExecutionRequest } from "./contracts";

function baseCallbacks(): WorkflowExecutionCallbacks {
  return {
    onEvent: () => {},
    onStepChange: () => {},
    onOutput: () => {},
    onHeartbeat: () => {},
    isCancelled: () => null,
    stopAfterRoundReason: () => null
  };
}

function baseRequest(): Omit<WorkflowExecutionRequest, "runCommand"> {
  return {
    task: {
      id: "task-a",
      runner: "custom",
      prompt: "base prompt",
      command: null,
      workflowSteps: [],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      workflowSharedSession: false,
      workflowFullAccess: false
    },
    preparedContext: {
      cwd: process.cwd(),
      prompt: "base prompt"
    },
    initialStepIndex: 0,
    resolveStepContext: async (_cwdInput, prompt, baseCwd) => ({ cwd: baseCwd, prompt }),
    callbacks: baseCallbacks()
  };
}

test("workflow executor supports managed codex shared session commands", async () => {
  const executor = new WorkflowExecutor();
  const calls: Array<{ command: string; envPatch?: Record<string, string> }> = [];

  const req = baseRequest();
  req.task.command = 'codex exec "{prompt}"';
  req.task.workflowSharedSession = true;
  req.task.workflowFullAccess = true;
  req.task.workflowSteps = [
    { name: "step-1" },
    { name: "step-2" }
  ];

  const result = await executor.execute({
    ...req,
    runCommand: async (command, _cwd, _timeoutSec, envPatch): Promise<CommandExecutionResult> => {
      calls.push({ command, envPatch });
      return { status: "success", exitCode: 0, stdout: "ok", stderr: "", error: null };
    }
  });

  assert.equal(result.status, "success");
  assert.equal(calls.length, 2);
  assert.match(calls[0].command, /^codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check '/);
  assert.match(calls[1].command, /^codex exec resume --last --all --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check '/);
  assert.ok(calls[0].envPatch?.CODEX_HOME);
  assert.equal(calls[0].envPatch?.CODEX_HOME, calls[1].envPatch?.CODEX_HOME);
});

test("workflow executor does not resume managed codex session after failed step", async () => {
  const executor = new WorkflowExecutor();
  const calls: Array<{ command: string; envPatch?: Record<string, string> }> = [];
  let attempt = 0;

  const req = baseRequest();
  req.task.command = 'codex exec "{prompt}"';
  req.task.workflowSharedSession = true;
  req.task.workflowSteps = [
    { name: "step-1", continueOnError: true },
    { name: "step-2" }
  ];

  const result = await executor.execute({
    ...req,
    runCommand: async (command, _cwd, _timeoutSec, envPatch): Promise<CommandExecutionResult> => {
      attempt += 1;
      calls.push({ command, envPatch });
      if (attempt === 1) {
        return { status: "failed", exitCode: 1, stdout: "", stderr: "startup failed", error: "startup failed" };
      }
      return { status: "success", exitCode: 0, stdout: "ok", stderr: "", error: null };
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(calls.length, 2);
  assert.match(calls[0].command, /^codex exec --full-auto --skip-git-repo-check '/);
  assert.match(calls[1].command, /^codex exec --full-auto --skip-git-repo-check '/);
  assert.ok(!calls[1].command.includes(" resume "));
  assert.equal(calls[0].envPatch?.CODEX_HOME, calls[1].envPatch?.CODEX_HOME);
});

test("workflow executor retries retryable failures", async () => {
  const executor = new WorkflowExecutor();
  let attempts = 0;

  const req = baseRequest();
  req.task.runner = "codex";
  req.task.workflowSteps = [{ name: "step-1", retryCount: 1, retryBackoffMs: 200 }];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => {
      attempts += 1;
      if (attempts === 1) {
        return {
          status: "failed",
          exitCode: 1,
          stdout: "",
          stderr: "HTTP 502 upstream gateway timeout",
          error: "upstream failed"
        };
      }
      return { status: "success", exitCode: 0, stdout: "ok", stderr: "", error: null };
    }
  });

  assert.equal(result.status, "success");
  assert.equal(attempts, 2);
});

test("workflow executor floors decimal retryCount to avoid extra retries", async () => {
  const executor = new WorkflowExecutor();
  let attempts = 0;

  const req = baseRequest();
  req.task.runner = "codex";
  req.task.workflowSteps = [{ name: "step-1", retryCount: 1.2, retryBackoffMs: 200 }];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => {
      attempts += 1;
      return {
        status: "failed",
        exitCode: 1,
        stdout: "",
        stderr: "HTTP 502 upstream gateway timeout",
        error: "upstream failed"
      };
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(attempts, 2);
});

test("workflow executor does not retry plain status code text without network context", async () => {
  const executor = new WorkflowExecutor();
  let attempts = 0;

  const req = baseRequest();
  req.task.runner = "codex";
  req.task.workflowSteps = [{ name: "step-1", retryCount: 1, retryBackoffMs: 200 }];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => {
      attempts += 1;
      return {
        status: "failed",
        exitCode: 1,
        stdout: "",
        stderr: "business rule check failed: status=500 but source is local parser",
        error: "validation failed"
      };
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(attempts, 1);
});

test("workflow executor keeps first-failure location when continueOnError is enabled", async () => {
  const executor = new WorkflowExecutor();
  let calls = 0;

  const req = baseRequest();
  req.task.runner = "codex";
  req.task.workflowSteps = [
    { name: "step-1", continueOnError: true },
    { name: "step-2" }
  ];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => {
      calls += 1;
      if (calls === 1) {
        return { status: "failed", exitCode: 2, stdout: "", stderr: "bad request", error: "boom" };
      }
      return { status: "success", exitCode: 0, stdout: "ok", stderr: "", error: null };
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(calls, 2);
  assert.match(String(result.error), /first failure at round 1, step 1\/2 \(step-1\)/);
});

test("workflow executor calls runModel for openai runner", async () => {
  const executor = new WorkflowExecutor();
  let runCommandCalls = 0;
  const modelCalls: Array<{ runner: string; prompt: string; cwd: string }> = [];

  const req = baseRequest();
  req.task.runner = "openai";
  req.task.workflowSteps = [{ name: "step-1" }];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => {
      runCommandCalls += 1;
      return { status: "success", exitCode: 0, stdout: "", stderr: "", error: null };
    },
    runModel: async (runner, prompt, cwd): Promise<CommandExecutionResult> => {
      modelCalls.push({ runner, prompt, cwd });
      return { status: "success", exitCode: 0, stdout: "model-ok", stderr: "", error: null };
    }
  });

  assert.equal(result.status, "success");
  assert.equal(runCommandCalls, 0);
  assert.equal(modelCalls.length, 1);
  assert.equal(modelCalls[0].runner, "openai");
  assert.match(modelCalls[0].prompt, /base prompt/);
});

test("workflow executor fails when model runner has no runModel handler", async () => {
  const executor = new WorkflowExecutor();
  const req = baseRequest();
  req.task.runner = "anthropic";
  req.task.workflowSteps = [{ name: "step-1" }];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => (
      { status: "success", exitCode: 0, stdout: "", stderr: "", error: null }
    )
  });

  assert.equal(result.status, "failed");
  assert.match(String(result.error), /requires runModel implementation/);
});

test("workflow executor runs tool step via runTool", async () => {
  const executor = new WorkflowExecutor();
  let runCommandCalls = 0;
  const toolCalls: Array<{ name: string; cwd: string; stepName?: string; input?: unknown }> = [];

  const req = baseRequest();
  req.task.workflowSteps = [{ name: "tool-step", tool: { name: "echo", input: { a: 1 } } }];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => {
      runCommandCalls += 1;
      return { status: "success", exitCode: 0, stdout: "", stderr: "", error: null };
    },
    runTool: async (call) => {
      toolCalls.push(call);
      return {
        success: true,
        output: "tool-ok",
        error: null
      };
    }
  });

  assert.equal(result.status, "success");
  assert.equal(runCommandCalls, 0);
  assert.equal(toolCalls.length, 1);
  assert.equal(toolCalls[0].name, "echo");
  assert.equal(toolCalls[0].stepName, "tool-step");
});

test("workflow executor converts thrown model runner error into failed result", async () => {
  const executor = new WorkflowExecutor();
  const req = baseRequest();
  req.task.runner = "openai";
  req.task.workflowSteps = [{ name: "step-1" }];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => (
      { status: "success", exitCode: 0, stdout: "", stderr: "", error: null }
    ),
    runModel: async () => {
      throw new Error("upstream model crashed");
    }
  });

  assert.equal(result.status, "failed");
  assert.match(String(result.error), /upstream model crashed/);
});

test("workflow executor converts thrown tool error into failed result", async () => {
  const executor = new WorkflowExecutor();
  const req = baseRequest();
  req.task.workflowSteps = [{ name: "tool-step", tool: { name: "echo" } }];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => (
      { status: "success", exitCode: 0, stdout: "", stderr: "", error: null }
    ),
    runTool: async () => {
      throw new Error("tool adapter crashed");
    }
  });

  assert.equal(result.status, "failed");
  assert.match(String(result.error), /tool adapter crashed/);
});

test("workflow executor fails when tool step has no runTool handler", async () => {
  const executor = new WorkflowExecutor();
  const req = baseRequest();
  req.task.workflowSteps = [{ name: "tool-step", tool: { name: "echo" } }];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => (
      { status: "success", exitCode: 0, stdout: "", stderr: "", error: null }
    )
  });

  assert.equal(result.status, "failed");
  assert.match(String(result.error), /tool step requires runTool implementation/);
});

test("workflow executor rejects tool step with blank tool name", async () => {
  const executor = new WorkflowExecutor();
  const req = baseRequest();
  req.task.workflowSteps = [{ name: "tool-step", tool: { name: "   " } }];

  let runToolCalls = 0;
  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => (
      { status: "success", exitCode: 0, stdout: "", stderr: "", error: null }
    ),
    runTool: async () => {
      runToolCalls += 1;
      return { success: true, output: "tool-ok", error: null };
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(runToolCalls, 0);
  assert.match(String(result.error), /requires non-empty tool name/);
});

test("workflow executor fails when workflow has no steps", async () => {
  const executor = new WorkflowExecutor();
  const req = baseRequest();
  req.task.workflowSteps = [];

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => (
      { status: "success", exitCode: 0, stdout: "", stderr: "", error: null }
    )
  });

  assert.equal(result.status, "failed");
  assert.match(String(result.error), /workflow requires at least one step/);
});

test("workflow executor fails when initialStepIndex is out of range", async () => {
  const executor = new WorkflowExecutor();
  const req = baseRequest();
  req.task.workflowSteps = [{ name: "step-1" }];

  const result = await executor.execute({
    ...req,
    initialStepIndex: 3,
    runCommand: async (): Promise<CommandExecutionResult> => (
      { status: "success", exitCode: 0, stdout: "", stderr: "", error: null }
    )
  });

  assert.equal(result.status, "failed");
  assert.match(String(result.error), /invalid initial step index/);
});

test("workflow executor does not mark codex session as started by tool step", async () => {
  const executor = new WorkflowExecutor();
  const calls: Array<{ command: string; envPatch?: Record<string, string> }> = [];

  const req = baseRequest();
  req.task.runner = "codex";
  req.task.command = 'codex exec "{prompt}"';
  req.task.workflowSharedSession = true;
  req.task.workflowSteps = [
    { name: "tool-step", tool: { name: "echo", input: { a: 1 } } },
    { name: "codex-step" }
  ];

  const result = await executor.execute({
    ...req,
    runTool: async () => ({ success: true, output: "tool-ok", error: null }),
    runCommand: async (command, _cwd, _timeoutSec, envPatch): Promise<CommandExecutionResult> => {
      calls.push({ command, envPatch });
      return { status: "success", exitCode: 0, stdout: "ok", stderr: "", error: null };
    }
  });

  assert.equal(result.status, "success");
  assert.equal(calls.length, 1);
  assert.match(calls[0].command, /^codex exec --full-auto --skip-git-repo-check '/);
  assert.ok(calls[0].envPatch?.CODEX_HOME);
});

test("default codex command still injects access flag when prompt text contains flag keyword", async () => {
  const executor = new WorkflowExecutor();
  const calls: Array<{ command: string }> = [];
  const req = baseRequest();
  req.task.runner = "codex";
  req.task.workflowSteps = [{ name: "step-1" }];
  req.preparedContext.prompt = "please explain --full-auto behavior";

  const result = await executor.execute({
    ...req,
    runCommand: async (command): Promise<CommandExecutionResult> => {
      calls.push({ command });
      return { status: "success", exitCode: 0, stdout: "ok", stderr: "", error: null };
    }
  });

  assert.equal(result.status, "success");
  assert.equal(calls.length, 1);
  assert.match(calls[0].command, /^codex exec --full-auto --skip-git-repo-check '/);
});

test("workflow executor allows tool step when inherited runner is model", async () => {
  const executor = new WorkflowExecutor();
  const req = baseRequest();
  req.task.runner = "openai";
  req.task.workflowSteps = [{ name: "tool-step", tool: { name: "echo" } }];

  let runToolCalls = 0;
  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => (
      { status: "success", exitCode: 0, stdout: "", stderr: "", error: null }
    ),
    runTool: async () => {
      runToolCalls += 1;
      return { success: true, output: "tool-ok", error: null };
    }
  });

  assert.equal(result.status, "success");
  assert.equal(runToolCalls, 1);
});

test("workflow executor emits buffered output for model and tool steps", async () => {
  const executor = new WorkflowExecutor();
  const outputChunks: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
  const req = baseRequest();
  req.task.runner = "openai";
  req.task.workflowSteps = [
    { name: "model-step" },
    { name: "tool-step", tool: { name: "echo" } }
  ];
  req.callbacks = {
    ...req.callbacks,
    onOutput: (stream, chunk) => {
      outputChunks.push({ stream, chunk });
    }
  };

  const result = await executor.execute({
    ...req,
    runCommand: async (): Promise<CommandExecutionResult> => (
      { status: "success", exitCode: 0, stdout: "", stderr: "", error: null }
    ),
    runModel: async (): Promise<CommandExecutionResult> => ({
      status: "success",
      exitCode: 0,
      stdout: "model-stdout",
      stderr: "model-stderr",
      error: null
    }),
    runTool: async () => ({
      success: false,
      output: "tool-stdout",
      error: "tool-stderr"
    })
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(outputChunks, [
    { stream: "stdout", chunk: "model-stdout" },
    { stream: "stderr", chunk: "model-stderr" },
    { stream: "stdout", chunk: "tool-stdout" },
    { stream: "stderr", chunk: "tool-stderr" }
  ]);
});

test("workflow executor sanitizes shared session CODEX_HOME path from task id", async () => {
  const executor = new WorkflowExecutor();
  const calls: Array<{ envPatch?: Record<string, string> }> = [];
  const req = baseRequest();
  req.task.id = "../outside/../../task-x";
  req.task.runner = "codex";
  req.task.command = 'codex exec "{prompt}"';
  req.task.workflowSharedSession = true;
  req.task.workflowSteps = [{ name: "step-1" }];

  const result = await executor.execute({
    ...req,
    runCommand: async (_command, _cwd, _timeoutSec, envPatch): Promise<CommandExecutionResult> => {
      calls.push({ envPatch });
      return { status: "success", exitCode: 0, stdout: "ok", stderr: "", error: null };
    }
  });

  assert.equal(result.status, "success");
  assert.equal(calls.length, 1);
  const codexHome = String(calls[0].envPatch?.CODEX_HOME || "");
  assert.ok(codexHome.startsWith(join(process.cwd(), ".agentlens", "codex-sessions")));
  assert.ok(!codexHome.includes(".."));
});
