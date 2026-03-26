import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoopScheduler } from "./engine";

async function createScheduler(): Promise<{ scheduler: LoopScheduler; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-validation-"));
  const scheduler = new LoopScheduler(join(dir, "loop-tasks.json"));
  await scheduler.init();
  return {
    scheduler,
    cleanup: async () => {
      scheduler.shutdown();
      await rm(dir, { recursive: true, force: true });
    }
  };
}

test("createTask rejects invalid workflow step cwd early", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    await assert.rejects(
      scheduler.createTask({
        name: "invalid-step-cwd-create",
        runner: "custom",
        prompt: "hello",
        intervalSec: 300,
        workflowSteps: [
          {
            name: "step-a",
            cwd: "/path/that/does/not/exist/for-agent-lens-tests",
            command: 'echo "{prompt}"',
            enabled: true
          }
        ]
      }),
      /workflow step "step-a" cwd invalid: path not found:/
    );
  } finally {
    await cleanup();
  }
});

test("updateTask rejects invalid workflow step cwd and keeps previous task", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    const task = await scheduler.createTask({
      name: "invalid-step-cwd-update",
      runner: "custom",
      prompt: "hello",
      intervalSec: 300,
      workflowSteps: [{ name: "ok", enabled: true }]
    });

    await assert.rejects(
      scheduler.updateTask(task.id, {
        workflowSteps: [
          {
            name: "bad-step",
            cwd: "/path/that/does/not/exist/for-agent-lens-tests-2",
            enabled: true
          }
        ]
      }),
      /workflow step "bad-step" cwd invalid: path not found:/
    );

    const persisted = scheduler.listTasks().find((item) => item.id === task.id);
    assert.ok(persisted);
    assert.equal(persisted?.workflowSteps[0]?.name, "ok");
  } finally {
    await cleanup();
  }
});

test("testTask rejects invalid workflow step cwd before execution", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    await assert.rejects(
      scheduler.testTask({
        name: "invalid-step-cwd-test-run",
        runner: "custom",
        prompt: "hello",
        intervalSec: 300,
        workflowSteps: [
          {
            name: "test-step",
            cwd: "/path/that/does/not/exist/for-agent-lens-tests-3",
            enabled: true
          }
        ]
      }),
      /workflow step "test-step" cwd invalid: path not found:/
    );
  } finally {
    await cleanup();
  }
});

test("createTask accepts relative workflow step cwd under task cwd", async () => {
  const { scheduler, cleanup } = await createScheduler();
  const base = await mkdtemp(join(tmpdir(), "agent-lens-loop-validation-base-"));
  try {
    await mkdir(join(base, "child"), { recursive: true });
    const task = await scheduler.createTask({
      name: "relative-step-cwd",
      runner: "custom",
      prompt: "hello",
      intervalSec: 300,
      cwd: base,
      workflowSteps: [
        {
          name: "step-rel",
          cwd: "child",
          enabled: true
        }
      ]
    });
    assert.equal(task.workflowSteps[0]?.cwd, "child");
  } finally {
    await cleanup();
    await rm(base, { recursive: true, force: true });
  }
});

test("updateTask rejects clearing task cwd when workflow step uses relative cwd", async () => {
  const { scheduler, cleanup } = await createScheduler();
  const base = await mkdtemp(join(tmpdir(), "agent-lens-loop-validation-update-clear-cwd-"));
  const stepRel = `child-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  try {
    await mkdir(join(base, stepRel), { recursive: true });
    const task = await scheduler.createTask({
      name: "clear-task-cwd-invalidates-relative-step",
      runner: "custom",
      prompt: "hello",
      intervalSec: 300,
      cwd: base,
      workflowSteps: [
        {
          name: "step-rel",
          cwd: stepRel,
          enabled: true
        }
      ]
    });

    await assert.rejects(
      scheduler.updateTask(task.id, { cwd: null }),
      /workflow step "step-rel" cwd invalid: path not found:/
    );
  } finally {
    await cleanup();
    await rm(base, { recursive: true, force: true });
  }
});

test("createTask rejects workflow with all steps disabled", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    await assert.rejects(
      scheduler.createTask({
        name: "all-disabled-create",
        runner: "custom",
        prompt: "hello",
        intervalSec: 300,
        workflowSteps: [
          { name: "s1", enabled: false },
          { name: "s2", enabled: false }
        ]
      }),
      /workflow must have at least one enabled step/
    );
  } finally {
    await cleanup();
  }
});

test("updateTask rejects workflow update with all steps disabled", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    const task = await scheduler.createTask({
      name: "all-disabled-update",
      runner: "custom",
      prompt: "hello",
      intervalSec: 300,
      workflowSteps: [{ name: "s1", enabled: true }]
    });
    await assert.rejects(
      scheduler.updateTask(task.id, {
        workflowSteps: [
          { name: "s1", enabled: false },
          { name: "s2", enabled: false }
        ]
      }),
      /workflow must have at least one enabled step/
    );
  } finally {
    await cleanup();
  }
});

test("testTask rejects workflow with all steps disabled", async () => {
  const { scheduler, cleanup } = await createScheduler();
  try {
    await assert.rejects(
      scheduler.testTask({
        name: "all-disabled-test",
        runner: "custom",
        prompt: "hello",
        intervalSec: 300,
        workflowSteps: [
          { name: "s1", enabled: false }
        ]
      }),
      /workflow must have at least one enabled step/
    );
  } finally {
    await cleanup();
  }
});

test("updateTask can patch non-workflow fields for legacy task with all workflow steps disabled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-legacy-disabled-"));
  const file = join(dir, "loop-tasks.json");
  await writeFile(
    file,
    JSON.stringify(
      {
        tasks: [
          {
            id: "legacy-disabled",
            name: "legacy",
            runner: "custom",
            prompt: "legacy prompt",
            workflow: [],
            workflowSteps: [
              { name: "s1", enabled: false, continueOnError: false }
            ],
            workflowCarryContext: true,
            workflowLoopFromStart: false,
            workflowSharedSession: true,
            workflowFullAccess: false,
            intervalSec: 60,
            timeoutSec: 60,
            enabled: true,
            cwd: null,
            command: 'echo "{prompt}"',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastRunAt: null
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  const scheduler = new LoopScheduler(file);
  await scheduler.init();
  try {
    const updated = await scheduler.updateTask("legacy-disabled", { name: "legacy-renamed" });
    assert.equal(updated.name, "legacy-renamed");
    const persisted = JSON.parse(await readFile(file, "utf8"));
    assert.equal(persisted.tasks[0].name, "legacy-renamed");
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test("legacy task with all workflow steps disabled fails runNow immediately", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-legacy-run-disabled-"));
  const file = join(dir, "loop-tasks.json");
  await writeFile(
    file,
    JSON.stringify(
      {
        tasks: [
          {
            id: "legacy-run-disabled",
            name: "legacy-run",
            runner: "custom",
            prompt: "legacy prompt",
            workflow: [],
            workflowSteps: [
              { name: "s1", enabled: false, continueOnError: false }
            ],
            workflowCarryContext: true,
            workflowLoopFromStart: false,
            workflowSharedSession: true,
            workflowFullAccess: false,
            intervalSec: 60,
            timeoutSec: 60,
            enabled: true,
            cwd: null,
            command: 'echo "{prompt}"',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastRunAt: null
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  const scheduler = new LoopScheduler(file);
  await scheduler.init();
  try {
    const run = await scheduler.runNow("legacy-run-disabled");
    assert.equal(run.status, "failed");
    assert.equal(run.error, "no enabled workflow steps");
    assert.equal(scheduler.getSettings().runningCount, 0);
    assert.equal(scheduler.getSettings().queuedCount, 0);
  } finally {
    scheduler.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});
