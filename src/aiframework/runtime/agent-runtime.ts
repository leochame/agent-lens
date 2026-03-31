import {
  RuntimeCommandExecutionHooks,
  RuntimeCommandExecutionResult,
  RuntimeModelProvider,
  RuntimeAgentRuntimeExecutionOverrides,
  RuntimeToolCall,
  RuntimeToolResult,
  RuntimeWorkflowExecutionResult
} from "./contracts";
import { TaskRuntime, TaskRuntimeExecutionRequest } from "./task-runtime";

export type AgentRuntimeExecutionOverrides = RuntimeAgentRuntimeExecutionOverrides;

export class AgentRuntime {
  private readonly taskRuntime: TaskRuntime;
  private executionOverrides: AgentRuntimeExecutionOverrides = {};

  constructor(options?: { taskRuntime?: TaskRuntime }) {
    this.taskRuntime = options?.taskRuntime ?? new TaskRuntime();
  }

  // Deprecated: keep only as a test helper for legacy cases.
  setExecutionOverrides(overrides: AgentRuntimeExecutionOverrides): void {
    this.executionOverrides = {
      ...this.executionOverrides,
      ...overrides
    };
  }

  // Deprecated: keep only as a test helper for legacy cases.
  clearExecutionOverrides(): void {
    this.executionOverrides = {};
  }

  inspectPath(rawPath: string, baseCwd: string | null = null): Promise<{ path: string; kind: "directory" | "file"; runCwd: string; promptHint: string | null }> {
    return this.taskRuntime.inspectPath(rawPath, baseCwd);
  }

  validateWorkflowStepPaths(
    steps: Array<{ name: string; cwd?: string | null }>,
    taskRunCwd: string | null
  ): Promise<void> {
    return this.taskRuntime.validateWorkflowStepPaths(steps, taskRunCwd);
  }

  resolveExecutionContext(
    cwdInput: string | null,
    prompt: string,
    baseCwd?: string
  ): Promise<{ cwd: string; prompt: string }> {
    return this.taskRuntime.resolveExecutionContext(cwdInput, prompt, baseCwd);
  }

  executeTask(req: TaskRuntimeExecutionRequest): Promise<RuntimeWorkflowExecutionResult> {
    return this.taskRuntime.executeTask({
      ...req,
      runCommand: req.runCommand ?? this.executionOverrides.runCommand,
      runModel: req.runModel ?? this.executionOverrides.runModel,
      runTool: req.runTool ?? this.executionOverrides.runTool,
      resolveStepContext: req.resolveStepContext ?? this.executionOverrides.resolveStepContext
    });
  }

  executeCommand(
    command: string,
    cwd: string,
    timeoutSec: number,
    envPatch?: Record<string, string>,
    hooks?: RuntimeCommandExecutionHooks
  ): Promise<RuntimeCommandExecutionResult> {
    return this.taskRuntime.executeCommand(command, cwd, timeoutSec, envPatch, hooks);
  }

  executeModel(provider: RuntimeModelProvider, prompt: string, cwd: string): Promise<RuntimeCommandExecutionResult> {
    return this.taskRuntime.executeModel(provider, prompt, cwd);
  }

  executeTool(call: RuntimeToolCall): Promise<RuntimeToolResult> {
    return this.taskRuntime.executeTool(call);
  }
}
