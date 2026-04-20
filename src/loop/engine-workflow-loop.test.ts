import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopScheduler } from "./engine";

type RuntimeExecutionOverrides = {
  runCommand?: (
    command: string,
    cwd: string,
    timeoutSec: number,
    envPatch?: Record<string, string>,
    hooks?: { onChunk?: (stream: "stdout" | "stderr", chunk: string) => void }
  ) => Promise<{ status: "success" | "failed"; exitCode: number | null; stdout: string; stderr: string; error: string | null }>;
  runModel?: (
    provider: "openai" | "anthropic",
    prompt: string,
    cwd: string
  ) => Promise<{ status: "success" | "failed"; exitCode: number | null; stdout: string; stderr: string; error: string | null }>;
  runTool?: (call: { name: string; input?: unknown }) => Promise<{ success: boolean; output: string; error: string | null }>;
};

function setRuntimeExecutionOverrides(
  scheduler: LoopScheduler,
  overrides: RuntimeExecutionOverrides
): void {
  const subject = scheduler as LoopScheduler & {
    __testExecutionOverrides?: RuntimeExecutionOverrides;
    __testOverridesBound?: boolean;
  };
  subject.__testExecutionOverrides = overrides;
  if (subject.__testOverridesBound) {
    return;
  }

  const originalRunNow = scheduler.runNow.bind(scheduler);
  const originalResumeNow = scheduler.resumeNow.bind(scheduler);
  subject.runNow = (async (taskId: string) => originalRunNow(taskId, {
    executionOverrides: subject.__testExecutionOverrides
  })) as LoopScheduler["runNow"];
  subject.resumeNow = (async (taskId: string, stepIndex?: number | null) => originalResumeNow(taskId, stepIndex, {
    executionOverrides: subject.__testExecutionOverrides
  })) as LoopScheduler["resumeNow"];
  subject.__testOverridesBound = true;
}

test("workflow loop-from-start runs a second round when enabled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-"));
  const marker = join(dir, "round-marker.txt");
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const task = await scheduler.createTask({
      name: "wf-loop-second-round",
      runner: "custom",
      prompt: "workflow loop test",
      workflowSteps: [
        {
          name: "step",
          command: `if [ -f "${marker}" ]; then echo "second round"; exit 7; else echo "first round"; touch "${marker}"; fi`,
          enabled: true
        }
      ],
      workflowCarryContext: false,
      workflowLoopFromStart: true,
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "failed");
    assert.match(run.stdout, /\[round 1\]/);
    assert.match(run.stdout, /\[round 2\]/);
    assert.match(run.stdout, /first round/);
    assert.match(run.stdout, /second round/);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow step can override cwd path from frontend config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-step-cwd-"));
  const baseDir = join(dir, "base");
  const stepDir = join(dir, "step");
  const stepFile = join(stepDir, "target.txt");
  await mkdir(baseDir, { recursive: true });
  await mkdir(stepDir, { recursive: true });
  await writeFile(join(baseDir, ".keep"), "", { encoding: "utf8" });
  await writeFile(stepFile, "ok", { encoding: "utf8" });

  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const task = await scheduler.createTask({
      name: "wf-step-cwd",
      runner: "custom",
      prompt: "workflow step cwd override",
      cwd: baseDir,
      workflowSteps: [
        {
          name: "step",
          cwd: stepFile,
          command: "pwd",
          enabled: true
        }
      ],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.ok(run.stdout.includes(stepDir));
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow step relative cwd resolves against task cwd", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-step-cwd-relative-"));
  const baseDir = join(dir, "base");
  const childDir = join(baseDir, "child");
  await mkdir(childDir, { recursive: true });

  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const task = await scheduler.createTask({
      name: "wf-step-cwd-relative",
      runner: "custom",
      prompt: "workflow step cwd relative",
      cwd: baseDir,
      workflowSteps: [
        {
          name: "step",
          cwd: "child",
          command: "pwd",
          enabled: true
        }
      ],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.ok(run.stdout.includes(childDir));
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow can switch between model runners on different steps", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-model-runners-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: Array<{ provider: string; prompt: string }> = [];
    setRuntimeExecutionOverrides(scheduler, {
      runModel: async (provider, prompt) => {
        calls.push({ provider, prompt });
        return {
          status: "success",
          exitCode: 0,
          stdout: `${provider}:ok`,
          stderr: "",
          error: null
        };
      }
    });

    const task = await scheduler.createTask({
      name: "wf-model-switch",
      runner: "openai",
      prompt: "model switch",
      workflowSteps: [
        { name: "step-openai", promptAppend: "step one prompt", enabled: true },
        { name: "step-anthropic", runner: "anthropic", promptAppend: "step two prompt", enabled: true }
      ],
      workflowLoopFromStart: false,
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].provider, "openai");
    assert.equal(calls[1].provider, "anthropic");
    assert.equal(calls[0].prompt, "model switch\n\nstep-openai\n\nstep one prompt");
    assert.equal(calls[1].prompt, "model switch\n\nstep-anthropic\n\nstep two prompt");
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow tool step runs via scheduler tool executor", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-tool-step-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    let commandCalls = 0;
    const toolCalls: Array<{ name: string; input: unknown }> = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async () => {
        commandCalls += 1;
        return {
          status: "success",
          exitCode: 0,
          stdout: "cmd-ok",
          stderr: "",
          error: null
        };
      },
      runTool: async (call) => {
        toolCalls.push({ name: call.name, input: call.input });
        return {
          success: true,
          output: "tool-ok",
          error: null
        };
      }
    });

    const task = await scheduler.createTask({
      name: "wf-tool-step",
      runner: "custom",
      prompt: "tool step",
      workflowSteps: [
        { name: "tool-1", tool: { name: "echo", input: { msg: "hello" } }, enabled: true }
      ],
      workflowLoopFromStart: false,
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(commandCalls, 0);
    assert.equal(toolCalls.length, 1);
    assert.equal(toolCalls[0].name, "echo");
    assert.deepEqual(toolCalls[0].input, { msg: "hello" });
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("scheduler passes workflowCarryContext to agent runtime", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-carry-context-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    let receivedCarryContext: boolean | null = null;
    const runtime = (scheduler as unknown as {
      runtime: {
        executeTask: (req: {
          task: { workflowCarryContext: boolean };
        }) => Promise<{
          status: "success";
          exitCode: 0;
          error: null;
          stdout: string;
          stderr: string;
          firstFailure: null;
        }>;
      };
    }).runtime;
    const originalExecuteTask = runtime.executeTask;
    runtime.executeTask = async (req) => {
      receivedCarryContext = req.task.workflowCarryContext;
      return {
        status: "success",
        exitCode: 0,
        error: null,
        stdout: "ok",
        stderr: "",
        firstFailure: null
      };
    };

    const task = await scheduler.createTask({
      name: "wf-carry-context-pass-through",
      runner: "custom",
      prompt: "carry context",
      workflowSteps: [{ name: "step-1", enabled: true }],
      workflowCarryContext: true,
      workflowLoopFromStart: false,
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(receivedCarryContext, true);
    runtime.executeTask = originalExecuteTask;
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("scheduler runModel override maps model success and failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-model-exec-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const task = await scheduler.createTask({
      name: "wf-model-exec-map",
      runner: "openai",
      prompt: "model success/fail mapping",
      workflowSteps: [{ name: "step-1", enabled: true }],
      workflowLoopFromStart: false,
      intervalSec: 300
    });

    setRuntimeExecutionOverrides(scheduler, {
      runModel: async (_provider, prompt) => ({
        status: "success",
        exitCode: 0,
        stdout: `ok:${prompt.slice(0, 5)}`,
        stderr: "",
        error: null
      })
    });
    const okRun = await scheduler.runNow(task.id);
    assert.equal(okRun.status, "success");
    assert.match(okRun.stdout, /ok:/);

    setRuntimeExecutionOverrides(scheduler, {
      runModel: async () => ({
        status: "failed",
        exitCode: null,
        stdout: "",
        stderr: "",
        error: "model boom"
      })
    });
    const failedRun = await scheduler.runNow(task.id);
    assert.equal(failedRun.status, "failed");
    assert.match(String(failedRun.error), /model boom/);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow shared session uses codex resume with isolated CODEX_HOME", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-shared-session-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: Array<{ cmd: string; envPatch?: Record<string, string> }> = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command, _cwd, _timeoutSec, envPatch) => {
      calls.push({ cmd: command, envPatch });
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "wf-shared-session",
      runner: "custom",
      prompt: "shared session prompt",
      command: 'codex exec "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true },
        { name: "step-2", enabled: true }
      ],
      workflowCarryContext: true,
      workflowLoopFromStart: false,
      workflowSharedSession: true,
      workflowFullAccess: true,
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 2);
    assert.match(calls[0].cmd, /^codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check '/);
    assert.match(calls[1].cmd, /^codex exec resume --last --all --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check '/);
    assert.ok(calls[0].envPatch && calls[0].envPatch.CODEX_HOME);
    assert.equal(calls[0].envPatch?.CODEX_HOME, calls[1].envPatch?.CODEX_HOME);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow shared session keeps custom codex exec flags across resume", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-shared-session-flags-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: Array<{ cmd: string; envPatch?: Record<string, string> }> = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command, _cwd, _timeoutSec, envPatch) => {
        calls.push({ cmd: command, envPatch });
        return {
          status: "success",
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          error: null
        };
      }
    });

    const task = await scheduler.createTask({
      name: "wf-shared-session-flags",
      runner: "custom",
      prompt: "shared session prompt",
      command: 'codex exec --model gpt-5.4 --config profile=dev "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true },
        { name: "step-2", enabled: true }
      ],
      workflowSharedSession: true,
      workflowFullAccess: false,
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 2);
    assert.match(calls[0].cmd, /^codex exec --full-auto --model gpt-5\.4 --config profile=dev '/);
    assert.match(calls[1].cmd, /^codex exec resume --last --all --full-auto --model gpt-5\.4 --config profile=dev '/);
    assert.equal(calls[0].envPatch?.CODEX_HOME, calls[1].envPatch?.CODEX_HOME);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("default runner command shell-quotes prompt safely", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-default-runner-quote-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      calls.push(command);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "default-runner-quote",
      runner: "codex",
      prompt: "O'Hara $(echo pwn)",
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^codex exec --full-auto --skip-git-repo-check '/);
    assert.ok(calls[0].includes("'\"'\"'"));
    assert.ok(calls[0].includes("$(echo pwn)"));
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("managed codex shared-session command shell-quotes prompt safely across rounds", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-managed-quote-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      calls.push(command);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "wf-managed-quote",
      runner: "custom",
      prompt: "shared O'Hara $(echo pwn)",
      command: 'codex exec "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true },
        { name: "step-2", enabled: true }
      ],
      workflowSharedSession: true,
      workflowFullAccess: false,
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 2);
    assert.match(calls[0], /^codex exec --full-auto --skip-git-repo-check '/);
    assert.match(calls[1], /^codex exec resume --last --all --full-auto --skip-git-repo-check '/);
    assert.ok(calls[0].includes("'\"'\"'"));
    assert.ok(calls[1].includes("'\"'\"'"));
    assert.ok(calls[0].includes("$(echo pwn)"));
    assert.ok(calls[1].includes("$(echo pwn)"));
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow session controls can force a fresh codex conversation for each step", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-session-step-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: Array<{ cmd: string; envPatch?: Record<string, string> }> = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command, _cwd, _timeoutSec, envPatch) => {
        calls.push({ cmd: command, envPatch });
        return {
          status: "success",
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          error: null
        };
      }
    });

    const task = await scheduler.createTask({
      name: "wf-session-each-step",
      runner: "custom",
      prompt: "shared prompt",
      command: 'codex exec "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true },
        { name: "step-2", enabled: true }
      ],
      workflowNewSessionPerStep: true,
      workflowNewSessionPerRound: true,
      workflowFullAccess: false,
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 2);
    assert.match(calls[0].cmd, /^codex exec --full-auto /);
    assert.match(calls[1].cmd, /^codex exec --full-auto /);
    assert.doesNotMatch(calls[1].cmd, /resume --last --all/);
    assert.equal(calls[0].envPatch, undefined);
    assert.equal(calls[1].envPatch, undefined);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow session controls can reset codex conversation on each new round", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-session-round-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: Array<{ cmd: string; envPatch?: Record<string, string> }> = [];
    let callCount = 0;
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command, _cwd, _timeoutSec, envPatch) => {
        calls.push({ cmd: command, envPatch });
        callCount += 1;
        if (callCount >= 4) {
          return {
            status: "failed",
            exitCode: 9,
            stdout: "",
            stderr: "stop after verifying second round",
            error: "stop after verifying second round"
          };
        }
        return {
          status: "success",
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          error: null
        };
      }
    });

    const task = await scheduler.createTask({
      name: "wf-session-each-round",
      runner: "custom",
      prompt: "shared prompt",
      command: 'codex exec "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true },
        { name: "step-2", enabled: true }
      ],
      workflowLoopFromStart: true,
      workflowNewSessionPerStep: false,
      workflowNewSessionPerRound: true,
      workflowFullAccess: false,
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "failed");
    assert.equal(calls.length, 4);
    assert.match(calls[0].cmd, /^codex exec --full-auto /);
    assert.match(calls[1].cmd, /^codex exec resume --last --all --full-auto /);
    assert.match(calls[2].cmd, /^codex exec --full-auto /);
    assert.doesNotMatch(calls[2].cmd, /resume --last --all/);
    assert.match(calls[3].cmd, /^codex exec resume --last --all --full-auto /);
    assert.notEqual(calls[0].envPatch?.CODEX_HOME, undefined);
    assert.notEqual(calls[2].envPatch?.CODEX_HOME, undefined);
    assert.notEqual(calls[0].envPatch?.CODEX_HOME, calls[2].envPatch?.CODEX_HOME);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("default claude_code runner shell-quotes prompt safely", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-claude-quote-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      calls.push(command);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "default-claude-quote",
      runner: "claude_code",
      prompt: "line1\nO'Hara $(echo pwn)",
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^claude -p '/);
    assert.ok(calls[0].includes("'\"'\"'"));
    assert.ok(calls[0].includes("$(echo pwn)"));
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("custom command template shell-quotes prompt safely", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-custom-template-quote-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      calls.push(command);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "custom-template-quote",
      runner: "custom",
      prompt: "line1\nO'Hara $(echo pwn)",
      command: 'echo "{prompt}"',
      workflowSharedSession: false,
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 1);
    assert.equal(calls[0], "echo 'line1\nO'\"'\"'Hara $(echo pwn)'");
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("custom codex command injects full-auto when full-access is disabled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-custom-codex-full-auto-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      calls.push(command);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "custom-codex-full-auto",
      runner: "custom",
      prompt: "line1\nO'Hara $(echo pwn)",
      command: 'codex exec "{prompt}"',
      workflowSharedSession: false,
      workflowFullAccess: false,
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^codex exec --full-auto '/);
    assert.ok(calls[0].includes("'\"'\"'"));
    assert.ok(calls[0].includes("$(echo pwn)"));
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("custom codex command injects danger flag when full-access is enabled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-custom-codex-danger-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      calls.push(command);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "custom-codex-danger",
      runner: "custom",
      prompt: "line1\nO'Hara $(echo pwn)",
      command: 'codex exec "{prompt}"',
      workflowSharedSession: false,
      workflowFullAccess: true,
      intervalSec: 300,
      timeoutSec: 30
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^codex exec --dangerously-bypass-approvals-and-sandbox '/);
    assert.ok(calls[0].includes("'\"'\"'"));
    assert.ok(calls[0].includes("$(echo pwn)"));
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow shared session defaults to enabled and full-access defaults to disabled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-default-flags-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const task = await scheduler.createTask({
      name: "wf-default-flags",
      runner: "custom",
      prompt: "defaults",
      command: 'codex exec "{prompt}"',
      intervalSec: 300
    });
    assert.equal(task.workflowNewSessionPerStep, false);
    assert.equal(task.workflowNewSessionPerRound, false);
    assert.equal(task.workflowSharedSession, true);
    assert.equal(task.workflowFullAccess, false);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("continueOnError failure reports explicit first-failure location", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-continue-on-error-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    let callCount = 0;
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          status: "failed",
          exitCode: 2,
          stdout: "",
          stderr: "sed: src/main/resources/application.yml: No such file or directory",
          error: null
        };
      }
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "continue-on-error-explicit",
      runner: "custom",
      prompt: "continue-on-error",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", continueOnError: true, enabled: true },
        { name: "step-2", continueOnError: false, enabled: true }
      ],
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "failed");
    assert.equal(run.exitCode, 2);
    assert.match(run.error || "", /first failure at round 1, step 1\/2 \(step-1\)/);
    assert.match(run.error || "", /status=failed, exit=2/);
    assert.match(run.error || "", /stderr=sed: src\/main\/resources\/application\.yml: No such file or directory/);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow step retries on retryable upstream/network failure and succeeds", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-step-retry-ok-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    let callCount = 0;
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          status: "failed",
          exitCode: 1,
          stdout: "",
          stderr: "HTTP 502 Bad Gateway, cf-ray: test",
          error: "upstream bad gateway"
        };
      }
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "retry-upstream-once",
      runner: "custom",
      prompt: "retry upstream",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true, retryCount: 1, retryBackoffMs: 200 }
      ],
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "success");
    assert.equal(callCount, 2);
    assert.match(run.stderr, /\[attempt 1\/2\]/);
    assert.match(run.stderr, /\[attempt 2\/2\]/);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow step does not retry non-network command failures", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-step-retry-no-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    let callCount = 0;
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async () => {
      callCount += 1;
      return {
        status: "failed",
        exitCode: 2,
        stdout: "",
        stderr: "sed: src/main/resources/application.yml: No such file or directory",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "retry-non-network-none",
      runner: "custom",
      prompt: "retry non network",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true, retryCount: 3, retryBackoffMs: 200 }
      ],
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "failed");
    assert.equal(callCount, 1);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow step does not retry generic timeout without network context", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-step-retry-timeout-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    let callCount = 0;
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async () => {
      callCount += 1;
      return {
        status: "failed",
        exitCode: 1,
        stdout: "",
        stderr: "Jest timeout of 5000ms exceeded while waiting for done() to be called.",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "retry-generic-timeout-none",
      runner: "custom",
      prompt: "retry generic timeout",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true, retryCount: 2, retryBackoffMs: 200 }
      ],
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "failed");
    assert.equal(callCount, 1);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow failure records checkpoint and resumeNow continues from failed step", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-resume-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    let step2Failures = 0;
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      calls.push(command);
      if (command.includes("step 2 unique") && step2Failures === 0) {
        step2Failures += 1;
        return {
          status: "failed",
          exitCode: 9,
          stdout: "",
          stderr: "step2 failed once",
          error: "step2 failed once"
        };
      }
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "workflow-resume-checkpoint",
      runner: "custom",
      prompt: "resume checkpoint",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", promptAppend: "step 1 unique", enabled: true },
        { name: "step-2", promptAppend: "step 2 unique", enabled: true }
      ],
      intervalSec: 300
    });

    const firstRun = await scheduler.runNow(task.id);
    assert.equal(firstRun.status, "failed");
    const afterFailure = scheduler.listTasks().find((item) => item.id === task.id);
    assert.equal(afterFailure?.workflowResumeStepIndex, 2);

    const resumedRun = await scheduler.resumeNow(task.id);
    assert.equal(resumedRun.status, "success");
    const afterResume = scheduler.listTasks().find((item) => item.id === task.id);
    assert.equal(afterResume?.workflowResumeStepIndex, null);

    const step1Calls = calls.filter((cmd) => cmd.includes("step 1 unique")).length;
    const step2Calls = calls.filter((cmd) => cmd.includes("step 2 unique")).length;
    assert.equal(step1Calls, 1);
    assert.equal(step2Calls, 2);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("updateTask can switch workflow task back to command mode", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-to-command-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const task = await scheduler.createTask({
      name: "workflow-to-command",
      runner: "custom",
      prompt: "before switch",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true },
        { name: "step-2", enabled: true }
      ],
      workflowLoopFromStart: true,
      intervalSec: 300
    });

    const updated = await scheduler.updateTask(task.id, {
      prompt: "after switch",
      workflow: "",
      workflowSteps: [],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      workflowSharedSession: true,
      workflowFullAccess: false
    });

    assert.deepEqual(updated.workflow, []);
    assert.deepEqual(updated.workflowSteps, []);
    assert.equal(updated.workflowLoopFromStart, false);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow loop-from-start can stop after current round completes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-stop-after-round-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      calls.push(command);
      await new Promise((resolve) => setTimeout(resolve, 30));
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "workflow-stop-after-round",
      runner: "custom",
      prompt: "stop after round",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", enabled: true },
        { name: "step-2", enabled: true }
      ],
      workflowLoopFromStart: true,
      intervalSec: 300
    });

    const pending = scheduler.runNow(task.id);
    while (calls.length < 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const stopInfo = scheduler.stopTask(task.id, "stop requested after current round", { afterRound: true });
    const run = await pending;

    assert.equal(stopInfo.deferred, true);
    assert.equal(run.status, "cancelled");
    assert.equal(run.error, "stop requested after current round");
    assert.equal(calls.length, 2);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow stop-after-round preserves checkpoint when round saw a failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-stop-after-round-checkpoint-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
        calls.push(command);
        if (command.includes("step-1 unique")) {
          return {
            status: "failed",
            exitCode: 3,
            stdout: "",
            stderr: "step-1 failed",
            error: "step-1 failed"
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          status: "success",
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          error: null
        };
      }
    });

    const task = await scheduler.createTask({
      name: "workflow-stop-after-round-checkpoint",
      runner: "custom",
      prompt: "stop after round checkpoint",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", promptAppend: "step-1 unique", enabled: true, continueOnError: true },
        { name: "step-2", enabled: true }
      ],
      workflowLoopFromStart: true,
      intervalSec: 300
    });

    const pending = scheduler.runNow(task.id);
    while (calls.length < 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    scheduler.stopTask(task.id, "stop requested after current round", { afterRound: true });
    const run = await pending;
    const updated = scheduler.listTasks().find((item) => item.id === task.id);

    assert.equal(run.status, "cancelled");
    assert.equal(updated?.workflowResumeStepIndex, 1);
    assert.match(updated?.workflowResumeReason || "", /stopped after current round/);
    assert.match(updated?.workflowResumeReason || "", /step 1\/2 \(step-1\)/);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow loop-from-start stops before next round when continueOnError captured a failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-stop-on-round-failure-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      calls.push(command);
      if (command.includes("step-1 unique")) {
        return {
          status: "failed",
          exitCode: 3,
          stdout: "",
          stderr: "step-1 failed",
          error: "step-1 failed"
        };
      }
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "workflow-stop-on-round-failure",
      runner: "custom",
      prompt: "stop after failure round",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", promptAppend: "step-1 unique", enabled: true, continueOnError: true },
        { name: "step-2", enabled: true }
      ],
      workflowLoopFromStart: true,
      intervalSec: 300
    });

    const run = await scheduler.runNow(task.id);
    assert.equal(run.status, "failed");
    assert.equal(calls.length, 2);
    assert.match(run.error || "", /first failure at round 1, step 1\/2 \(step-1\)/);
    assert.equal(run.stdout.includes("[round 2]"), false);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow definition update clears stale resume checkpoint", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-clear-checkpoint-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    let step2Failures = 0;
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      if (command.includes("step 2 unique") && step2Failures === 0) {
        step2Failures += 1;
        return {
          status: "failed",
          exitCode: 9,
          stdout: "",
          stderr: "step2 failed once",
          error: "step2 failed once"
        };
      }
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "workflow-clear-checkpoint",
      runner: "custom",
      prompt: "clear checkpoint on workflow change",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", promptAppend: "step 1 unique", enabled: true },
        { name: "step-2", promptAppend: "step 2 unique", enabled: true }
      ],
      intervalSec: 300
    });

    const firstRun = await scheduler.runNow(task.id);
    assert.equal(firstRun.status, "failed");
    const checkpointed = scheduler.listTasks().find((item) => item.id === task.id);
    assert.equal(checkpointed?.workflowResumeStepIndex, 2);

    const updated = await scheduler.updateTask(task.id, {
      workflowSteps: [{ name: "step-1", enabled: true }]
    });
    assert.equal(updated.workflowResumeStepIndex, null);
    assert.equal(updated.workflowResumeUpdatedAt, null);
    assert.equal(updated.workflowResumeReason, null);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("non-workflow update keeps resume checkpoint when workflow payload is unchanged", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-keep-checkpoint-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    let step2Failures = 0;
    setRuntimeExecutionOverrides(scheduler, {
      runCommand: async (command) => {
      if (command.includes("step 2 unique") && step2Failures === 0) {
        step2Failures += 1;
        return {
          status: "failed",
          exitCode: 7,
          stdout: "",
          stderr: "step2 failed once",
          error: "step2 failed once"
        };
      }
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
      }
    });

    const task = await scheduler.createTask({
      name: "workflow-keep-checkpoint",
      runner: "custom",
      prompt: "keep checkpoint on non-workflow update",
      command: 'echo "{prompt}"',
      workflowSteps: [
        { name: "step-1", promptAppend: "step 1 unique", enabled: true },
        { name: "step-2", promptAppend: "step 2 unique", enabled: true }
      ],
      intervalSec: 300
    });

    const firstRun = await scheduler.runNow(task.id);
    assert.equal(firstRun.status, "failed");
    const checkpointed = scheduler.listTasks().find((item) => item.id === task.id);
    assert.equal(checkpointed?.workflowResumeStepIndex, 2);
    assert.equal(Boolean(checkpointed?.workflowResumeReason), true);

    const updated = await scheduler.updateTask(task.id, {
      prompt: "keep checkpoint on non-workflow update v2",
      workflow: "",
      workflowSteps: checkpointed?.workflowSteps || []
    });
    assert.equal(updated.workflowResumeStepIndex, 2);
    assert.equal(Boolean(updated.workflowResumeUpdatedAt), true);
    assert.equal(Boolean(updated.workflowResumeReason), true);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});
