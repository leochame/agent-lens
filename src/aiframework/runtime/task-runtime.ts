import { stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { ZshCommandRunner } from "../adapters/command/zsh-command-runner";
import { FileMemoryStore } from "../adapters/memory/file-memory-store";
import { createModelClient } from "../adapters/model/model-client-factory";
import {
  RuntimeCommandExecutionHooks,
  RuntimeCommandExecutionResult,
  RuntimeCommandRunner,
  RuntimeMemoryStore,
  RuntimeModelClient,
  RuntimeModelProvider,
  RuntimeTaskRuntimeExecutionRequest,
  RuntimeToolCall,
  RuntimeToolExecutor,
  RuntimeToolResult,
  RuntimeWorkflowExecutionResult
} from "./contracts";
import { ToolRegistry } from "./tool-registry";
import { WorkflowExecutor } from "./workflow-executor";

function normalizePrompt(prompt: string): string {
  return String(prompt ?? "").trim();
}

export type TaskRuntimeExecutionRequest = RuntimeTaskRuntimeExecutionRequest;

export class TaskRuntime {
  private readonly commandRunner: RuntimeCommandRunner;
  private readonly workflowExecutor: WorkflowExecutor;
  private readonly modelClientFactory: typeof createModelClient;
  private readonly toolExecutor: RuntimeToolExecutor;
  private readonly memoryStore: RuntimeMemoryStore;
  private readonly modelClients: Map<RuntimeModelProvider, RuntimeModelClient> = new Map();

  constructor(options?: {
    commandRunner?: RuntimeCommandRunner;
    workflowExecutor?: WorkflowExecutor;
    modelClientFactory?: typeof createModelClient;
    toolExecutor?: RuntimeToolExecutor;
    memoryStore?: RuntimeMemoryStore;
  }) {
    this.commandRunner = options?.commandRunner ?? new ZshCommandRunner();
    this.workflowExecutor = options?.workflowExecutor ?? new WorkflowExecutor();
    this.modelClientFactory = options?.modelClientFactory ?? createModelClient;
    this.toolExecutor = options?.toolExecutor ?? new ToolRegistry();
    this.memoryStore = options?.memoryStore ?? new FileMemoryStore();
  }

  async inspectPath(
    rawPath: string,
    baseCwd: string | null = null
  ): Promise<{ path: string; kind: "directory" | "file"; runCwd: string; promptHint: string | null }> {
    const value = String(rawPath ?? "").trim();
    if (!value) {
      throw new Error("path is required");
    }

    const absolute = baseCwd && !isAbsolute(value) ? resolve(baseCwd, value) : resolve(value);
    let details;
    try {
      details = await stat(absolute);
    } catch {
      throw new Error(`path not found: ${absolute}`);
    }

    if (details.isDirectory()) {
      return { path: absolute, kind: "directory", runCwd: absolute, promptHint: null };
    }
    if (details.isFile()) {
      return {
        path: absolute,
        kind: "file",
        runCwd: dirname(absolute),
        promptHint: `Focus file: ${absolute}`
      };
    }
    throw new Error(`path must be a directory or file: ${absolute}`);
  }

  async resolveExecutionContext(
    cwdInput: string | null,
    prompt: string,
    baseCwd?: string
  ): Promise<{ cwd: string; prompt: string }> {
    const cleanPrompt = normalizePrompt(prompt);
    const cleanCwdInput = cwdInput == null ? "" : String(cwdInput).trim();
    if (!cleanCwdInput) {
      return { cwd: process.cwd(), prompt: cleanPrompt };
    }

    const inspected = await this.inspectPath(cleanCwdInput, baseCwd ?? null);
    if (inspected.kind === "directory") {
      return { cwd: inspected.runCwd, prompt: cleanPrompt };
    }
    return {
      cwd: inspected.runCwd,
      prompt: `${cleanPrompt}\n\n${inspected.promptHint}`
    };
  }

  async validateWorkflowStepPaths(
    steps: Array<{ name: string; cwd?: string | null }>,
    taskRunCwd: string | null
  ): Promise<void> {
    for (const step of steps) {
      const raw = step && step.cwd != null ? String(step.cwd).trim() : "";
      if (!raw) {
        continue;
      }
      try {
        await this.inspectPath(raw, taskRunCwd);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stepName = step.name ? String(step.name) : "(unnamed)";
        throw new Error(`workflow step "${stepName}" cwd invalid: ${message}`);
      }
    }
  }

  async executeTask(req: TaskRuntimeExecutionRequest): Promise<RuntimeWorkflowExecutionResult> {
    let taskPrompt = req.task.prompt;
    if (req.task.workflowCarryContext) {
      try {
        const memoryContext = (await this.memoryStore.loadContext(req.task.id)).trim();
        if (memoryContext) {
          taskPrompt = `${taskPrompt}\n\n[Memory Context]\n${memoryContext}`;
          req.callbacks.onEvent("info", "loaded memory context for current task");
        } else {
          req.callbacks.onEvent("info", "no memory context found for current task");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        req.callbacks.onEvent("error", `load memory context failed: ${message}`);
      }
    }

    const preparedContext = await this.resolveExecutionContext(req.cwdInput, taskPrompt);
    req.callbacks.onEvent("info", `resolved execution cwd: ${preparedContext.cwd}`);

    const result = await this.workflowExecutor.execute({
      task: req.task,
      preparedContext,
      initialStepIndex: req.initialStepIndex,
      runCommand: req.runCommand
        ?? ((command, cwd, timeoutSec, envPatch, hooks) => this.executeCommand(command, cwd, timeoutSec, envPatch, {
          ...hooks,
          onSpawn: req.onCommandSpawn
        })),
      runModel: req.runModel
        ?? ((provider, prompt, cwd) => this.executeModel(provider, prompt, cwd)),
      runTool: req.runTool
        ?? ((call) => this.executeTool(call)),
      resolveStepContext: req.resolveStepContext
        ?? ((cwdInput, prompt, baseCwd) => this.resolveExecutionContext(cwdInput, prompt, baseCwd)),
      callbacks: req.callbacks
    });

    if (req.task.workflowCarryContext) {
      try {
        await this.memoryStore.saveRecord(req.task.id, {
          at: new Date().toISOString(),
          prompt: req.task.prompt,
          result: {
            status: result.status,
            error: result.error,
            stdout: result.stdout,
            stderr: result.stderr
          }
        });
        req.callbacks.onEvent("info", "saved memory context for current task");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        req.callbacks.onEvent("error", `save memory context failed: ${message}`);
      }
    }

    return result;
  }

  executeCommand(
    command: string,
    cwd: string,
    timeoutSec: number,
    envPatch?: Record<string, string>,
    hooks?: RuntimeCommandExecutionHooks
  ): Promise<RuntimeCommandExecutionResult> {
    return this.commandRunner.run(command, cwd, timeoutSec, envPatch, hooks);
  }

  async executeModel(provider: RuntimeModelProvider, prompt: string, _cwd: string): Promise<RuntimeCommandExecutionResult> {
    const client = this.getModelClient(provider);
    try {
      const response = await client.chat({ prompt });
      return {
        status: "success",
        exitCode: 0,
        stdout: response.text,
        stderr: "",
        error: null
      };
    } catch (error) {
      return {
        status: "failed",
        exitCode: null,
        stdout: "",
        stderr: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  executeTool(call: RuntimeToolCall): Promise<RuntimeToolResult> {
    return this.toolExecutor.execute(call);
  }

  getModelClient(provider: RuntimeModelProvider): RuntimeModelClient {
    const cached = this.modelClients.get(provider);
    if (cached) {
      return cached;
    }
    const client = this.modelClientFactory({ provider });
    this.modelClients.set(provider, client);
    return client;
  }
}
