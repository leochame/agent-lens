import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  RuntimeCommandExecutionResult,
  RuntimeMemoryStore,
  RuntimeModelChatRequest,
  RuntimeToolCall,
  RuntimeWorkflowExecutionResult,
  RuntimeWorkflowStepInput
} from "../runtime/contracts";
import type { MemoryStore, TaskMemoryRecord } from "./memory";
import type { ModelChatRequest } from "./model";
import type { ToolCall } from "./tool";
import type { CommandExecutionResult, WorkflowExecutionResult, WorkflowStepInput } from "./workflow";

const coreRoot = join(process.cwd(), "src", "aiframework", "core");

const facadeFiles = ["model.ts", "workflow.ts", "memory.ts", "tool.ts"];

for (const file of facadeFiles) {
  test(`core facade ${file} aliases runtime contracts only`, async () => {
    const content = await readFile(join(coreRoot, file), "utf8");
    assert.match(content, /from "\.\.\/runtime\/contracts"/);
    assert.doesNotMatch(content, /from "\.\/workflow"/);
    assert.doesNotMatch(content, /from "\.\/tool"/);
    assert.doesNotMatch(content, /interface\s+\w+\s*\{/);
    assert.doesNotMatch(content, /type\s+\w+\s*=\s*\{/);
  });
}

test("core legacy aliases stay runtime-compatible", () => {
  const modelReq: ModelChatRequest = { prompt: "hello", model: "gpt-test" };
  const runtimeModelReq: RuntimeModelChatRequest = modelReq;

  const toolCall: ToolCall = { name: "echo", cwd: "/tmp", input: { text: "ok" } };
  const runtimeToolCall: RuntimeToolCall = toolCall;

  const commandResult: CommandExecutionResult = {
    status: "success",
    exitCode: 0,
    stdout: "ok",
    stderr: "",
    error: null
  };
  const runtimeCommandResult: RuntimeCommandExecutionResult = commandResult;

  const workflowStep: WorkflowStepInput = { name: "s1", runner: "custom", enabled: true };
  const runtimeWorkflowStep: RuntimeWorkflowStepInput = workflowStep;

  const workflowResult: WorkflowExecutionResult = {
    status: "success",
    exitCode: 0,
    error: null,
    stdout: "",
    stderr: "",
    firstFailure: null
  };
  const runtimeWorkflowResult: RuntimeWorkflowExecutionResult = workflowResult;

  const memoryStore: MemoryStore = {
    async loadContext() {
      return "";
    },
    async saveRecord(_taskId, _record) {
      return;
    }
  };
  const runtimeMemoryStore: RuntimeMemoryStore = memoryStore;

  const record: TaskMemoryRecord = {
    at: new Date(0).toISOString(),
    prompt: "p",
    result: {
      status: "success",
      error: null,
      stdout: "",
      stderr: ""
    }
  };

  assert.equal(runtimeModelReq.prompt, "hello");
  assert.equal(runtimeToolCall.name, "echo");
  assert.equal(runtimeCommandResult.status, "success");
  assert.equal(runtimeWorkflowStep.name, "s1");
  assert.equal(runtimeWorkflowResult.firstFailure, null);
  assert.equal(typeof runtimeMemoryStore.loadContext, "function");
  assert.equal(record.result.status, "success");
});
