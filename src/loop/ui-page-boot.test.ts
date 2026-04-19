import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderLoopHtml } from "./html";

type FakeElement = InstanceType<typeof BaseElement>;

class FakeClassList {
  private readonly items = new Set<string>();

  add(name: string): void {
    this.items.add(name);
  }

  remove(name: string): void {
    this.items.delete(name);
  }

  contains(name: string): boolean {
    return this.items.has(name);
  }
}

class BaseElement {
  id: string;
  value = "";
  textContent = "";
  className = "";
  disabled = false;
  checked = false;
  open = false;
  isConnected = true;
  parentNode: BaseElement | null = null;
  readonly classList = new FakeClassList();
  readonly style: Record<string, string> = {};
  private readonly attributes = new Map<string, string>();
  private innerHtmlValue = "";
  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(id = "") {
    this.id = id;
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(handler);
    this.listeners.set(type, current);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  remove(): void {
    this.isConnected = false;
  }

  insertAdjacentElement(_position: string, element: BaseElement): void {
    element.parentNode = this.parentNode;
  }

  closest(): null {
    return null;
  }

  querySelector(): null {
    return null;
  }

  get innerHTML(): string {
    return this.innerHtmlValue;
  }

  set innerHTML(value: string) {
    this.innerHtmlValue = String(value);
  }

  focus(): void {}

  scrollIntoView(): void {}
}

class FakeButtonElement extends BaseElement {}
class FakeInputElement extends BaseElement {}
class FakeTextAreaElement extends BaseElement {}
class FakeSelectElement extends BaseElement {}

class FakeDocument {
  readonly elements = new Map<string, BaseElement>();
  activeElement: BaseElement | null = null;

  constructor(ids: string[]) {
    for (const id of ids) {
      this.elements.set(id, this.createElementForId(id));
    }
  }

  getElementById(id: string): BaseElement {
    const existing = this.elements.get(id);
    if (existing) {
      return existing;
    }
    const created = this.createElementForId(id);
    this.elements.set(id, created);
    return created;
  }

  createElement(tagName: string): BaseElement {
    if (tagName === "button") {
      return new FakeButtonElement();
    }
    return new BaseElement();
  }

  private createElementForId(id: string): BaseElement {
    if (id === "prompt") {
      return new FakeTextAreaElement(id);
    }
    if (
      id === "runner"
      || id === "advancedMode"
      || id === "maxConcurrentRuns"
      || id === "workflowLoopFromStart"
      || id === "workflowSharedSession"
      || id === "workflowFullAccess"
    ) {
      return new FakeSelectElement(id);
    }
    if (
      id === "name"
      || id === "intervalSec"
      || id === "taskSearch"
      || id === "cwd"
      || id === "command"
    ) {
      return new FakeInputElement(id);
    }
    if (id.endsWith("Btn")) {
      return new FakeButtonElement(id);
    }
    return new BaseElement(id);
  }
}

function extractScript(html: string): string {
  const scriptStart = html.indexOf("<script>");
  const scriptEnd = html.lastIndexOf("</script>");
  assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, "script block should exist");
  return html.slice(scriptStart + "<script>".length, scriptEnd);
}

function extractFunctionSource(script: string, fnName: string): string {
  const start = script.indexOf(`function ${fnName}(`);
  if (start < 0) {
    throw new Error(`function not found: ${fnName}`);
  }
  const open = script.indexOf("{", start);
  if (open < 0) {
    throw new Error(`function body not found: ${fnName}`);
  }
  let depth = 0;
  for (let i = open; i < script.length; i += 1) {
    const ch = script[i];
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return script.slice(start, i + 1);
      }
    }
  }
  throw new Error(`function parse failed: ${fnName}`);
}

function extractIds(html: string): string[] {
  return [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
}

test("loop page boots and renders current task payload without runtime error", async () => {
  const html = renderLoopHtml();
  const script = extractScript(html);
  const document = new FakeDocument(extractIds(html));
  const storedLoopState = JSON.parse(
    readFileSync(join(process.cwd(), "config/loop-tasks.json"), "utf8")
  ) as { tasks: Array<{ name?: string }> };
  const loopState = {
    tasks: [
      {
        id: "boot-task",
        name: "Boot task",
        runner: "custom",
        prompt: "Inspect the repo",
        workflow: [],
        workflowSteps: [
          {
            name: "Inspect the repo",
            retryCount: 0,
            retryBackoffMs: 1200,
            continueOnError: false,
            enabled: true
          }
        ],
        workflowCarryContext: false,
        workflowLoopFromStart: false,
        workflowSharedSession: false,
        workflowFullAccess: false,
        workflowResumeStepIndex: null,
        workflowResumeUpdatedAt: null,
        workflowResumeReason: null,
        intervalSec: 900,
        enabled: true,
        cwd: null,
        command: "codex exec \"{prompt}\"",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        lastRunAt: null
      }
    ]
  };

  const localStorageData = new Map<string, string>();
  class FakeEventSource {
    readyState = 1;
    addEventListener(): void {}
    close(): void {}
  }

  const windowObject = {
    EventSource: FakeEventSource,
    confirm(): boolean {
      return true;
    },
    prompt(): null {
      return null;
    }
  };

  const context = vm.createContext({
    console,
    document,
    window: windowObject,
    localStorage: {
      getItem(key: string): string | null {
        return localStorageData.get(key) ?? null;
      },
      setItem(key: string, value: string): void {
        localStorageData.set(key, value);
      }
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        item: {
          tasks: loopState.tasks,
          runs: [],
          liveRuns: [],
          queue: [],
          settings: { maxConcurrentRuns: 4, runningCount: 0, queuedCount: 0 }
        },
        generatedAt: new Date("2026-04-01T15:17:03.851Z").toISOString()
      })
    }),
    EventSource: FakeEventSource,
    HTMLElement: BaseElement,
    HTMLButtonElement: FakeButtonElement,
    HTMLInputElement: FakeInputElement,
    HTMLTextAreaElement: FakeTextAreaElement,
    HTMLSelectElement: FakeSelectElement,
    setInterval(): number {
      return 0;
    },
    setTimeout(callback: () => void): number {
      callback();
      return 0;
    }
  });

  assert.doesNotThrow(() => {
    vm.runInContext(
      `${script}
this.__loopUi__ = { fillFormFromTask, applyDynamicVisibility };`,
      context
    );
  });

  await new Promise<void>((resolve) => setImmediate(resolve));

  const taskList = document.getElementById("taskList");
  const msg = document.getElementById("msg");
  assert.equal(storedLoopState.tasks.length, 0);
  assert.ok(taskList.innerHTML.includes(String(loopState.tasks[0]?.name || "")));
  assert.doesNotMatch(msg.className, /error/);

  const ui = (context as { __loopUi__?: { fillFormFromTask: (task: unknown) => void; applyDynamicVisibility: () => void } }).__loopUi__;
  assert.ok(ui, "loop ui helpers should be exposed for regression checks");

  const workflowMode = document.getElementById("advancedMode");
  workflowMode.value = "workflow";
  assert.doesNotThrow(() => {
    ui.applyDynamicVisibility();
    ui.fillFormFromTask(loopState.tasks[0]);
  });
  assert.equal(workflowMode.value, "workflow");
  assert.doesNotMatch(msg.className, /error/);
});

test("loop page relies on the shared sidebar for loop routing", () => {
  const html = renderLoopHtml();
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/__router"/);
  assert.match(html, /href="\/__log"/);
  assert.match(html, /href="\/__loop"/);
  assert.match(html, /class="workbench-link active" href="\/__loop"/);
  assert.match(html, /Workflow \/ Loop/);
  assert.doesNotMatch(html, /aria-label="页面入口"/);
  assert.match(html, /class="hero-grid"/);
  assert.match(html, /运行概览/);
  assert.match(html, /以 workflow 为主，单命令模式为兼容入口/);
  assert.doesNotMatch(html, /侧边栏负责切换页面/);
});

test("beginEditTask keeps composer edit state through loop-state refresh", async () => {
  const html = renderLoopHtml();
  const script = extractScript(html);
  const document = new FakeDocument(extractIds(html));
  const storedLoopState = JSON.parse(
    readFileSync(join(process.cwd(), "config/loop-tasks.json"), "utf8")
  ) as {
    tasks: Array<{ id: string; name: string }>;
  };
  const loopState = {
    tasks: [
      {
        id: "edit-task",
        name: "Edit task"
      }
    ]
  };

  class FakeEventSource {
    readyState = 1;
    addEventListener(): void {}
    close(): void {}
  }

  const context = vm.createContext({
    console,
    document,
    window: {
      EventSource: FakeEventSource,
      confirm(): boolean {
        return true;
      },
      prompt(): null {
        return null;
      }
    },
    localStorage: {
      getItem(): null {
        return null;
      },
      setItem(): void {}
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        item: {
          tasks: loopState.tasks,
          runs: [],
          liveRuns: [],
          queue: [],
          settings: { maxConcurrentRuns: 4, runningCount: 0, queuedCount: 0 }
        },
        generatedAt: new Date("2026-04-01T15:17:03.851Z").toISOString()
      })
    }),
    EventSource: FakeEventSource,
    HTMLElement: BaseElement,
    HTMLButtonElement: FakeButtonElement,
    HTMLInputElement: FakeInputElement,
    HTMLTextAreaElement: FakeTextAreaElement,
    HTMLSelectElement: FakeSelectElement,
    setInterval(): number {
      return 0;
    },
    setTimeout(callback: () => void): number {
      callback();
      return 0;
    }
  });

  vm.runInContext(
    `${script}
this.__loopUi__ = { beginEditTask, applyLoopState };`,
    context
  );

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(storedLoopState.tasks.length, 0);

  const ui = (context as {
    __loopUi__?: {
      beginEditTask: (task: unknown) => void;
      applyLoopState: (item: unknown, generatedAt?: string | null) => void;
    };
  }).__loopUi__;
  assert.ok(ui, "loop ui edit helpers should be exposed for regression checks");

  ui.beginEditTask(loopState.tasks[0]);
  const createBtn = document.getElementById("createBtn");
  const nameInput = document.getElementById("name");
  assert.equal(createBtn.textContent, "保存修改");
  nameInput.value = "手工修改中的名称";

  ui.applyLoopState(
    {
      tasks: loopState.tasks,
      runs: [],
      liveRuns: [],
      queue: [],
      settings: { maxConcurrentRuns: 4, runningCount: 0, queuedCount: 0 }
    },
    new Date("2026-04-01T15:17:08.851Z").toISOString()
  );

  assert.equal(createBtn.textContent, "保存修改");
  assert.equal(nameInput.value, "手工修改中的名称");
});

test("open task detail keeps dialog body stable across live state refresh", async () => {
  const html = renderLoopHtml();
  const script = extractScript(html);
  const document = new FakeDocument(extractIds(html));
  const loopTask = {
    id: "detail-task",
    name: "Detail task",
    runner: "custom",
    prompt: "Inspect the repo",
    workflow: [],
    workflowSteps: [
      {
        name: "Inspect",
        retryCount: 0,
        retryBackoffMs: 1200,
        continueOnError: false,
        enabled: true
      }
    ],
    workflowCarryContext: false,
    workflowLoopFromStart: true,
    workflowSharedSession: true,
    workflowFullAccess: false,
    workflowResumeStepIndex: null,
    workflowResumeUpdatedAt: null,
    workflowResumeReason: null,
    intervalSec: 900,
    enabled: true,
    cwd: "/tmp/repo",
    command: "codex exec \"{prompt}\"",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    lastRunAt: null
  };

  class CountingElement extends BaseElement {
    writeCount = 0;

    set innerHTML(value: string) {
      super.innerHTML = value;
      this.writeCount += 1;
    }
  }

  class FakeEventSource {
    readyState = 1;
    addEventListener(): void {}
    close(): void {}
  }

  document.elements.set("taskDetailBody", new CountingElement("taskDetailBody"));

  const context = vm.createContext({
    console,
    document,
    window: {
      EventSource: FakeEventSource,
      confirm(): boolean {
        return true;
      },
      prompt(): null {
        return null;
      }
    },
    localStorage: {
      getItem(): null {
        return null;
      },
      setItem(): void {}
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        item: {
          tasks: [loopTask],
          runs: [],
          liveRuns: [],
          queue: [],
          settings: { maxConcurrentRuns: 4, runningCount: 0, queuedCount: 0 }
        },
        generatedAt: new Date("2026-04-01T15:17:03.851Z").toISOString()
      })
    }),
    EventSource: FakeEventSource,
    HTMLElement: BaseElement,
    HTMLButtonElement: FakeButtonElement,
    HTMLInputElement: FakeInputElement,
    HTMLTextAreaElement: FakeTextAreaElement,
    HTMLSelectElement: FakeSelectElement,
    setInterval(): number {
      return 0;
    },
    setTimeout(callback: () => void): number {
      callback();
      return 0;
    }
  });

  vm.runInContext(
    `${script}
this.__loopUi__ = { openTaskDetail, applyLoopState };`,
    context
  );

  await new Promise<void>((resolve) => setImmediate(resolve));

  const ui = (context as {
    __loopUi__?: {
      openTaskDetail: (taskId: string) => void;
      applyLoopState: (item: unknown, generatedAt?: string | null) => void;
    };
  }).__loopUi__;
  assert.ok(ui, "loop ui detail helpers should be exposed for regression checks");

  const taskDetailBody = document.getElementById("taskDetailBody") as CountingElement;
  ui.openTaskDetail(loopTask.id);
  assert.equal(taskDetailBody.writeCount, 1);

  ui.applyLoopState(
    {
      tasks: [{ ...loopTask, lastRunAt: "2026-04-01T15:19:03.851Z" }],
      runs: [],
      liveRuns: [
        {
          taskId: loopTask.id,
          taskName: loopTask.name,
          runner: loopTask.runner,
          trigger: "manual",
          phase: "running",
          startedAt: "2026-04-01T15:18:03.851Z",
          heartbeatAt: "2026-04-01T15:19:00.000Z",
          silenceSec: 3,
          heartbeatStale: false,
          round: 1,
          stepIndex: 1,
          totalSteps: 1,
          stepName: "Inspect",
          events: [],
          stdoutTail: "",
          stderrTail: ""
        }
      ],
      queue: [
        {
          taskId: loopTask.id,
          taskName: loopTask.name,
          trigger: "manual",
          enqueuedAt: "2026-04-01T15:18:04.000Z",
          waitMs: 1200
        }
      ],
      settings: { maxConcurrentRuns: 4, runningCount: 1, queuedCount: 1 }
    },
    new Date("2026-04-01T15:19:03.851Z").toISOString()
  );

  assert.equal(taskDetailBody.writeCount, 1);
});

test("saveLastSuccess is best-effort when storage is unavailable", () => {
  const html = renderLoopHtml();
  const script = extractScript(html);
  let warned = 0;
  const context = vm.createContext({
    window: {
      console: {
        warn(): void {
          warned += 1;
        }
      }
    },
    localStorage: {
      setItem(): never {
        throw new Error("quota exceeded");
      }
    }
  });

  vm.runInContext(
    `const STORAGE_LAST_SUCCESS = "agentlens.loop.lastSuccess.v1";
${extractFunctionSource(script, "saveLastSuccess")}
this.__save__ = saveLastSuccess;`,
    context
  );

  const save = (context as { __save__?: (body: unknown) => void }).__save__;
  assert.ok(save, "saveLastSuccess should be exposed for regression checks");
  assert.doesNotThrow(() => save({ name: "test" }));
  assert.equal(warned, 1);
});
