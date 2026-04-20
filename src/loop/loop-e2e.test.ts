import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import vm from "node:vm";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderLoopHtml } from "./html";
import { startServer } from "../router/proxy/server";

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
  nodeType = 1;
  id: string;
  tagName: string;
  value = "";
  textContent = "";
  className = "";
  disabled = false;
  checked = false;
  open = false;
  isConnected = true;
  parentNode: BaseElement | null = null;
  parentElement: BaseElement | null = null;
  nextSibling: BaseElement | null = null;
  readonly classList = new FakeClassList();
  readonly style: Record<string, string> = {};
  private readonly attributes = new Map<string, string>();
  private innerHtmlValue = "";
  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(id = "", tagName = "DIV") {
    this.id = id;
    this.tagName = tagName;
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(handler);
    this.listeners.set(type, current);
  }

  dispatch(type: string, event: unknown): void {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  remove(): void {
    this.isConnected = false;
  }

  insertAdjacentElement(_position: string, element: BaseElement): void {
    element.parentNode = this.parentNode;
    element.parentElement = this.parentElement;
  }

  insertBefore(element: BaseElement, _referenceNode?: BaseElement | null): void {
    element.parentNode = this;
    element.parentElement = this;
  }

  appendChild(element: BaseElement): void {
    element.parentNode = this;
    element.parentElement = this;
  }

  removeChild(element: BaseElement): void {
    element.parentNode = null;
    element.parentElement = null;
  }

  closest(): null {
    return null;
  }

  querySelector(): null {
    return null;
  }

  querySelectorAll(): BaseElement[] {
    return [];
  }

  focus(): void {}

  scrollIntoView(): void {}

  get innerHTML(): string {
    return this.innerHtmlValue;
  }

  set innerHTML(value: string) {
    this.innerHtmlValue = String(value);
  }
}

class FakeButtonElement extends BaseElement {
  constructor(id = "") {
    super(id, "BUTTON");
  }
}

class FakeInputElement extends BaseElement {
  constructor(id = "") {
    super(id, "INPUT");
  }
}

class FakeTextAreaElement extends BaseElement {
  constructor(id = "") {
    super(id, "TEXTAREA");
  }
}

class FakeSelectElement extends BaseElement {
  constructor(id = "") {
    super(id, "SELECT");
  }
}

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
    if (tagName === "textarea") {
      return new FakeTextAreaElement();
    }
    if (tagName === "input") {
      return new FakeInputElement();
    }
    if (tagName === "select") {
      return new FakeSelectElement();
    }
    return new BaseElement("", tagName.toUpperCase());
  }

  addEventListener(): void {}

  private createElementForId(id: string): BaseElement {
    if (id === "prompt" || id === "modalPrompt" || id === "modalWorkflowSteps") {
      return new FakeTextAreaElement(id);
    }
    if (
      id === "runner"
      || id === "advancedMode"
      || id === "maxConcurrentRuns"
      || id === "workflowLoopFromStart"
      || id === "workflowNewSessionPerStep"
      || id === "workflowNewSessionPerRound"
      || id === "workflowFullAccess"
      || id === "modalRunner"
      || id === "modalMode"
      || id === "modalWorkflowLoop"
      || id === "modalWorkflowSessionPerStep"
      || id === "modalWorkflowSessionPerRound"
      || id === "modalWorkflowAccess"
    ) {
      return new FakeSelectElement(id);
    }
    if (
      id === "name"
      || id === "intervalSec"
      || id === "taskSearch"
      || id === "cwd"
      || id === "command"
      || id === "modalName"
      || id === "modalInterval"
      || id === "modalCwd"
      || id === "modalCommand"
    ) {
      return new FakeInputElement(id);
    }
    if (id.endsWith("Btn")) {
      return new FakeButtonElement(id);
    }
    return new BaseElement(id);
  }
}

class FakeEventSource {
  readyState = 1;
  onerror: (() => void) | null = null;

  addEventListener(): void {}

  close(): void {
    this.readyState = 2;
  }
}

function extractScript(html: string): string {
  const scriptStart = html.indexOf("<script>");
  const scriptEnd = html.lastIndexOf("</script>");
  assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, "script block should exist");
  return html.slice(scriptStart + "<script>".length, scriptEnd);
}

function extractIds(html: string): string[] {
  return [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
}

async function reservePort(): Promise<number> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert(address && typeof address === "object");
  const { port } = address;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

test("loop page drives workflow test-run and create-task through the real loop API", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-loop-e2e-"));
  const workspaceDir = join(dir, "workspace");
  const port = await reservePort();
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(join(dir, "config"), { recursive: true });

  const started = await startServer(
    {
      listen: { host: "127.0.0.1", port },
      routing: { defaultProvider: "openai" },
      providers: {
        openai: { baseURL: "https://api.openai.example" }
      },
      logging: { filePath: "logs/req.log", archiveRequests: false }
    },
    join(dir, "config/default.yaml")
  );

  try {
    const html = renderLoopHtml();
    const script = extractScript(html);
    const document = new FakeDocument(extractIds(html));
    const requests: Array<{
      path: string;
      method: string;
      requestBody: string | null;
      responseBody: unknown;
      status: number;
    }> = [];
    const baseUrl = `http://127.0.0.1:${port}`;
    const fetchProxy = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url, baseUrl);
      const response = await fetch(url, init);
      const clone = response.clone();
      let responseBody: unknown = null;
      try {
        responseBody = await clone.json();
      } catch {
        responseBody = await clone.text();
      }
      requests.push({
        path: url.pathname,
        method: String(init?.method || "GET").toUpperCase(),
        requestBody: typeof init?.body === "string" ? init.body : null,
        responseBody,
        status: response.status
      });
      return response;
    };

    const context = vm.createContext({
      console,
      document,
      window: {
        EventSource: FakeEventSource,
        addEventListener(): void {},
        confirm(): boolean {
          return true;
        },
        prompt(): null {
          return null;
        },
        console
      },
      localStorage: {
        getItem(): null {
          return null;
        },
        setItem(): void {}
      },
      fetch: fetchProxy,
      EventSource: FakeEventSource,
      HTMLElement: BaseElement,
      HTMLButtonElement: FakeButtonElement,
      HTMLInputElement: FakeInputElement,
      HTMLTextAreaElement: FakeTextAreaElement,
      HTMLSelectElement: FakeSelectElement,
      setInterval(): number {
        return 0;
      },
      clearInterval(): void {},
      setTimeout(callback: () => void): number {
        callback();
        return 0;
      },
      clearTimeout(): void {}
    });

    vm.runInContext(
      `${script}
this.__loopUi__ = { fillFormFromTask, testRun, createTask, collectFormBody };`,
      context
    );

    await new Promise<void>((resolve) => setImmediate(resolve));

    const ui = (context as {
      __loopUi__?: {
        fillFormFromTask: (task: Record<string, unknown>) => void;
        testRun: () => Promise<void>;
        createTask: () => Promise<void>;
        collectFormBody: (syncWorkflow?: boolean) => Record<string, unknown>;
      };
    }).__loopUi__;
    assert.ok(ui, "loop ui helpers should be exposed for e2e checks");

    ui.fillFormFromTask({
      id: "workflow-e2e-source",
      name: "workflow-e2e-preview",
      runner: "custom",
      prompt: "base prompt",
      workflowSteps: [
        {
          name: "review current changes",
          command: 'printf "%s" "{prompt}"',
          promptAppend: "focus on failing tests",
          enabled: true
        }
      ],
      workflowCarryContext: false,
      workflowLoopFromStart: false,
      workflowSharedSession: false,
      workflowFullAccess: false,
      intervalSec: 300,
      cwd: workspaceDir,
      command: null
    });

    const cwdInput = document.getElementById("cwd");
    cwdInput.value = workspaceDir;

    const previewBody = ui.collectFormBody(false);
    assert.equal(previewBody.prompt, "base prompt");
    assert.equal(Array.isArray(previewBody.workflowSteps), true);
    assert.equal((previewBody.workflowSteps as Array<Record<string, unknown>>)[0]?.promptAppend, "focus on failing tests");

    await ui.testRun();

    const testRunRequest = requests.filter((item) => item.path === "/__loop/api/test-run").at(-1);
    assert.ok(testRunRequest, "test-run request should be sent");
    assert.equal(testRunRequest.status, 200);
    assert.equal(typeof testRunRequest.requestBody, "string");
    assert.match(String(document.getElementById("msg").textContent || ""), /测试成功/);
    assert.match(
      JSON.stringify(testRunRequest.responseBody),
      /base prompt\\n\\nreview current changes\\n\\nfocus on failing tests/
    );

    document.getElementById("name").value = "workflow-e2e-saved";
    await ui.createTask();

    const createTaskRequest = requests.filter((item) => item.path === "/__loop/api/tasks" && item.method === "POST").at(-1);
    assert.ok(createTaskRequest, "create-task request should be sent");
    assert.equal(createTaskRequest.status, 200);
    const createTaskBody = JSON.parse(String(createTaskRequest.requestBody || "{}")) as {
      workflowSteps?: Array<{ name?: string; promptAppend?: string; command?: string }>;
    };
    assert.equal(createTaskBody.workflowSteps?.length, 1);
    assert.equal(createTaskBody.workflowSteps?.[0]?.name, "review current changes");
    assert.equal(createTaskBody.workflowSteps?.[0]?.promptAppend, "focus on failing tests");
    assert.equal(createTaskBody.workflowSteps?.[0]?.command, 'printf "%s" "{prompt}"');

    const tasksResponse = await fetch(`${baseUrl}/__loop/api/tasks`);
    const tasksPayload = await tasksResponse.json() as {
      items: Array<{ name: string; workflowSteps?: Array<{ promptAppend?: string }> }>;
    };
    const savedTask = tasksPayload.items.find((item) => item.name === "workflow-e2e-saved");
    assert.ok(savedTask, "saved task should be returned by loop api");
    assert.equal(savedTask.workflowSteps?.[0]?.promptAppend, "focus on failing tests");
  } finally {
    await started.close();
    started.shutdownLoop();
    await rm(dir, { recursive: true, force: true });
  }
});
