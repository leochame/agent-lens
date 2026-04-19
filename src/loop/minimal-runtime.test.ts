import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopFileMemoryStore } from "./file-memory-store";
import { MinimalLoopRuntime } from "./minimal-runtime";
import { LoopToolRegistry } from "./tool-registry";

function createCallbacks() {
  return {
    onEvent: () => {},
    onStepChange: () => {},
    onOutput: () => {},
    onHeartbeat: () => {},
    isCancelled: () => null,
    stopAfterRoundReason: () => null
  };
}

test("minimal runtime provides default OpenAI model execution", async () => {
  const runtime = new MinimalLoopRuntime();
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      output_text: "model-ok",
      model: "gpt-test",
      usage: { input_tokens: 1, output_tokens: 2 }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const result = await runtime.executeTask({
      task: {
        id: "model-task",
        runner: "openai",
        prompt: "hello model",
        command: null,
        workflowSteps: [{ name: "step-1", enabled: true }],
        workflowCarryContext: false,
        workflowLoopFromStart: false,
        workflowSharedSession: false,
        workflowFullAccess: false
      },
      cwdInput: null,
      initialStepIndex: 0,
      callbacks: createCallbacks()
    });

    assert.equal(result.status, "success");
    assert.match(result.stdout, /model-ok/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.openai.com/v1/responses");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test("minimal runtime provides default tool execution via registry", async () => {
  const toolRegistry = new LoopToolRegistry();
  toolRegistry.register({
    name: "echo",
    execute: async (call) => ({
      success: true,
      output: JSON.stringify({ cwd: call.cwd, input: call.input }),
      error: null
    })
  });
  const runtime = new MinimalLoopRuntime({ toolRegistry });

  const result = await runtime.executeTask({
    task: {
      id: "tool-task",
      runner: "custom",
      prompt: "hello tool",
      command: null,
      workflowSteps: [{ name: "tool-step", tool: { name: "echo", input: { msg: "hi" } }, enabled: true }],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      workflowSharedSession: false,
      workflowFullAccess: false
    },
    cwdInput: null,
    initialStepIndex: 0,
    callbacks: createCallbacks()
  });

  assert.equal(result.status, "success");
  assert.match(result.stdout, /"msg":"hi"/);
});

test("minimal runtime loads and saves workflow carry context", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-minimal-runtime-memory-"));
  const memoryStore = new LoopFileMemoryStore({ baseDir: dir });
  const runtime = new MinimalLoopRuntime({ memoryStore });
  await memoryStore.saveRecord("carry-task", {
    at: new Date().toISOString(),
    prompt: "old prompt",
    result: {
      status: "success",
      error: null,
      stdout: "previous stdout",
      stderr: ""
    }
  });

  const prompts: string[] = [];
  try {
    const result = await runtime.executeTask({
      task: {
        id: "carry-task",
        runner: "openai",
        prompt: "current prompt",
        command: null,
        workflowSteps: [{ name: "step-1", enabled: true }],
        workflowCarryContext: true,
        workflowLoopFromStart: false,
        workflowSharedSession: false,
        workflowFullAccess: false
      },
      cwdInput: null,
      initialStepIndex: 0,
      callbacks: createCallbacks(),
      runModel: async (_provider, prompt) => {
        prompts.push(prompt);
        return {
          status: "success",
          exitCode: 0,
          stdout: "new stdout",
          stderr: "",
          error: null
        };
      }
    });

    assert.equal(result.status, "success");
    assert.equal(prompts.length, 1);
    assert.match(prompts[0], /\[Memory Context\]/);
    assert.match(prompts[0], /previous stdout/);

    const storedContext = await memoryStore.loadContext("carry-task");
    assert.match(storedContext, /previous stdout/);
    assert.match(storedContext, /new stdout/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("minimal runtime appends raw step name without workflow wrapper text", async () => {
  const runtime = new MinimalLoopRuntime();
  const prompts: string[] = [];

  const result = await runtime.executeTask({
    task: {
      id: "name-fallback-task",
      runner: "openai",
      prompt: "base prompt",
      command: null,
      workflowSteps: [{ name: "review current changes", enabled: true }],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      workflowSharedSession: false,
      workflowFullAccess: false
    },
    cwdInput: null,
    initialStepIndex: 0,
    callbacks: createCallbacks(),
    runModel: async (_provider, prompt) => {
      prompts.push(prompt);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(result.status, "success");
  assert.deepEqual(prompts, ["base prompt\n\nreview current changes"]);
});

test("minimal runtime keeps workflow prompt clean and appends only raw step text", async () => {
  const runtime = new MinimalLoopRuntime();
  const prompts: string[] = [];

  const result = await runtime.executeTask({
    task: {
      id: "step-only-text-task",
      runner: "openai",
      prompt: "base prompt",
      command: null,
      workflowSteps: [{ name: "review current changes", promptAppend: "focus on failing tests", enabled: true }],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      workflowSharedSession: false,
      workflowFullAccess: false
    },
    cwdInput: null,
    initialStepIndex: 0,
    callbacks: createCallbacks(),
    runModel: async (_provider, prompt) => {
      prompts.push(prompt);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(result.status, "success");
  assert.deepEqual(prompts, ["base prompt\n\nreview current changes\n\nfocus on failing tests"]);
});
