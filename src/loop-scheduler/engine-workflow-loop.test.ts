import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopScheduler } from "./engine";

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

test("workflow shared session uses codex resume with isolated CODEX_HOME", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-shared-session-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: Array<{ cmd: string; envPatch?: Record<string, string> }> = [];
    (scheduler as unknown as {
      executeCommand: (
        command: string,
        cwd: string,
        timeoutSec: number,
        envPatch?: Record<string, string>
      ) => Promise<{ status: "success"; exitCode: number; stdout: string; stderr: string; error: null }>;
    }).executeCommand = async (command, _cwd, _timeoutSec, envPatch) => {
      calls.push({ cmd: command, envPatch });
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
    };

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

test("default runner command shell-quotes prompt safely", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-default-runner-quote-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    (scheduler as unknown as {
      executeCommand: (
        command: string,
        cwd: string,
        timeoutSec: number,
        envPatch?: Record<string, string>
      ) => Promise<{ status: "success"; exitCode: number; stdout: string; stderr: string; error: null }>;
    }).executeCommand = async (command) => {
      calls.push(command);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
    };

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
    (scheduler as unknown as {
      executeCommand: (
        command: string,
        cwd: string,
        timeoutSec: number,
        envPatch?: Record<string, string>
      ) => Promise<{ status: "success"; exitCode: number; stdout: string; stderr: string; error: null }>;
    }).executeCommand = async (command) => {
      calls.push(command);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
    };

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

test("default claude_code runner shell-quotes prompt safely", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-workflow-claude-quote-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  try {
    const calls: string[] = [];
    (scheduler as unknown as {
      executeCommand: (
        command: string,
        cwd: string,
        timeoutSec: number,
        envPatch?: Record<string, string>
      ) => Promise<{ status: "success"; exitCode: number; stdout: string; stderr: string; error: null }>;
    }).executeCommand = async (command) => {
      calls.push(command);
      return {
        status: "success",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        error: null
      };
    };

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
    assert.equal(task.workflowSharedSession, true);
    assert.equal(task.workflowFullAccess, false);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});
