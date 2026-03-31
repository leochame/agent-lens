import type { ChildProcessWithoutNullStreams } from "node:child_process";

export type RuntimeModelProvider = "openai" | "anthropic";

export type RuntimeModelChatRequest = {
  prompt: string;
  model?: string;
};

export type RuntimeModelChatResponse = {
  text: string;
  model: string | null;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  };
  raw: unknown;
};

export interface RuntimeModelClient {
  chat(req: RuntimeModelChatRequest): Promise<RuntimeModelChatResponse>;
}

export type RuntimeToolCall = {
  name: string;
  input?: unknown;
  cwd: string;
  stepName?: string;
};

export type RuntimeToolResult = {
  success: boolean;
  output: string;
  error?: string | null;
};

export type RuntimeToolDefinition = {
  name: string;
  description?: string;
  execute: (call: RuntimeToolCall) => Promise<RuntimeToolResult> | RuntimeToolResult;
};

export interface RuntimeToolExecutor {
  execute(call: RuntimeToolCall): Promise<RuntimeToolResult>;
}

export type RuntimeCommandExecutionStatus = "success" | "failed" | "timeout" | "cancelled";

export type RuntimeCommandExecutionResult = {
  status: RuntimeCommandExecutionStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error: string | null;
};

export type RuntimeCommandExecutionHooks = {
  onSpawn?: (child: ChildProcessWithoutNullStreams) => void;
  cancellationReason?: () => string | null;
  onChunk?: (stream: "stdout" | "stderr", chunk: string) => void;
  onHeartbeat?: () => void;
};

export interface RuntimeCommandRunner {
  run(
    command: string,
    cwd: string,
    timeoutSec: number,
    envPatch?: Record<string, string>,
    hooks?: RuntimeCommandExecutionHooks
  ): Promise<RuntimeCommandExecutionResult>;
}

export type RuntimeWorkflowRunner = "claude_code" | "codex" | "custom" | "openai" | "anthropic";

export type RuntimeWorkflowStepInput = {
  name: string;
  runner?: RuntimeWorkflowRunner;
  cwd?: string | null;
  command?: string | null;
  tool?: {
    name: string;
    input?: unknown;
  };
  promptAppend?: string;
  retryCount?: number;
  retryBackoffMs?: number;
  continueOnError?: boolean;
  enabled?: boolean;
};

export type RuntimeWorkflowTaskInput = {
  id: string;
  runner: RuntimeWorkflowRunner;
  prompt: string;
  command: string | null;
  workflowSteps: RuntimeWorkflowStepInput[];
  workflowCarryContext: boolean;
  workflowLoopFromStart: boolean;
  workflowSharedSession: boolean;
  workflowFullAccess: boolean;
};

export type RuntimeWorkflowExecutionCallbacks = {
  onEvent: (level: "info" | "error", message: string) => void;
  onStepChange: (round: number, stepIndex: number, totalSteps: number, stepName: string | null) => void;
  onOutput: (stream: "stdout" | "stderr", chunk: string) => void;
  onHeartbeat: () => void;
  isCancelled: () => string | null;
  stopAfterRoundReason: () => string | null;
};

export type RuntimeWorkflowExecutionFirstFailure = {
  result: RuntimeCommandExecutionResult;
  round: number;
  stepIndex: number;
  stepCount: number;
  stepName: string;
};

export type RuntimeWorkflowExecutionResult = {
  status: RuntimeCommandExecutionStatus;
  exitCode: number | null;
  error: string | null;
  stdout: string;
  stderr: string;
  firstFailure: RuntimeWorkflowExecutionFirstFailure | null;
};

export type RuntimeWorkflowPreparedContext = {
  cwd: string;
  prompt: string;
};

export type RuntimeResolveStepContext = (
  cwdInput: string,
  prompt: string,
  baseCwd: string
) => Promise<{ cwd: string; prompt: string }>;

export type RuntimeRunCommand = (
  command: string,
  cwd: string,
  timeoutSec: number,
  envPatch?: Record<string, string>,
  hooks?: RuntimeCommandExecutionHooks
) => Promise<RuntimeCommandExecutionResult>;

export type RuntimeRunModel = (
  provider: RuntimeModelProvider,
  prompt: string,
  cwd: string
) => Promise<RuntimeCommandExecutionResult>;

export type RuntimeRunTool = (call: RuntimeToolCall) => Promise<RuntimeToolResult>;

export type RuntimeTaskRuntimeExecutionRequest = {
  task: RuntimeWorkflowTaskInput;
  cwdInput: string | null;
  initialStepIndex: number;
  callbacks: RuntimeWorkflowExecutionCallbacks;
  onCommandSpawn?: (child: ChildProcessWithoutNullStreams) => void;
  runCommand?: RuntimeRunCommand;
  runModel?: RuntimeRunModel;
  runTool?: RuntimeRunTool;
  resolveStepContext?: RuntimeResolveStepContext;
};

export type RuntimeAgentRuntimeExecutionOverrides = {
  runCommand?: RuntimeRunCommand;
  runModel?: RuntimeRunModel;
  runTool?: RuntimeRunTool;
  resolveStepContext?: RuntimeResolveStepContext;
};

export type RuntimeWorkflowExecutionRequest = {
  task: RuntimeWorkflowTaskInput;
  preparedContext: RuntimeWorkflowPreparedContext;
  initialStepIndex: number;
  runCommand: RuntimeRunCommand;
  runModel?: RuntimeRunModel;
  runTool?: RuntimeRunTool;
  resolveStepContext: RuntimeResolveStepContext;
  callbacks: RuntimeWorkflowExecutionCallbacks;
};

export type RuntimeTaskMemoryRecord = {
  at: string;
  prompt: string;
  result: Pick<RuntimeWorkflowExecutionResult, "status" | "error" | "stdout" | "stderr">;
};

export interface RuntimeMemoryStore {
  loadContext(taskId: string): Promise<string>;
  saveRecord(taskId: string, record: RuntimeTaskMemoryRecord): Promise<void>;
}

// Backward-compatible aliases for existing scheduler code/tests.
// Deprecation window: 2026-03-31 to 2026-09-30.
// Planned removal: v2.0.0 (after 2026-09-30) once all call sites use Runtime* names.
/** @deprecated Use RuntimeModelProvider. Removal target: v2.0.0 after 2026-09-30. */
export type ModelProvider = RuntimeModelProvider;
/** @deprecated Use RuntimeModelChatRequest. Removal target: v2.0.0 after 2026-09-30. */
export type ModelChatRequest = RuntimeModelChatRequest;
/** @deprecated Use RuntimeModelChatResponse. Removal target: v2.0.0 after 2026-09-30. */
export type ModelChatResponse = RuntimeModelChatResponse;
/** @deprecated Use RuntimeModelClient. Removal target: v2.0.0 after 2026-09-30. */
export type ModelClient = RuntimeModelClient;
/** @deprecated Use RuntimeToolCall. Removal target: v2.0.0 after 2026-09-30. */
export type ToolCall = RuntimeToolCall;
/** @deprecated Use RuntimeToolResult. Removal target: v2.0.0 after 2026-09-30. */
export type ToolResult = RuntimeToolResult;
/** @deprecated Use RuntimeToolDefinition. Removal target: v2.0.0 after 2026-09-30. */
export type ToolDefinition = RuntimeToolDefinition;
/** @deprecated Use RuntimeToolExecutor. Removal target: v2.0.0 after 2026-09-30. */
export type ToolExecutor = RuntimeToolExecutor;
/** @deprecated Use RuntimeCommandExecutionStatus. Removal target: v2.0.0 after 2026-09-30. */
export type CommandExecutionStatus = RuntimeCommandExecutionStatus;
/** @deprecated Use RuntimeCommandExecutionResult. Removal target: v2.0.0 after 2026-09-30. */
export type CommandExecutionResult = RuntimeCommandExecutionResult;
/** @deprecated Use RuntimeCommandExecutionHooks. Removal target: v2.0.0 after 2026-09-30. */
export type CommandExecutionHooks = RuntimeCommandExecutionHooks;
/** @deprecated Use RuntimeCommandRunner. Removal target: v2.0.0 after 2026-09-30. */
export type CommandRunner = RuntimeCommandRunner;
/** @deprecated Use RuntimeWorkflowRunner. Removal target: v2.0.0 after 2026-09-30. */
export type WorkflowRunner = RuntimeWorkflowRunner;
/** @deprecated Use RuntimeWorkflowStepInput. Removal target: v2.0.0 after 2026-09-30. */
export type WorkflowStepInput = RuntimeWorkflowStepInput;
/** @deprecated Use RuntimeWorkflowTaskInput. Removal target: v2.0.0 after 2026-09-30. */
export type WorkflowTaskInput = RuntimeWorkflowTaskInput;
/** @deprecated Use RuntimeWorkflowExecutionCallbacks. Removal target: v2.0.0 after 2026-09-30. */
export type WorkflowExecutionCallbacks = RuntimeWorkflowExecutionCallbacks;
/** @deprecated Use RuntimeWorkflowPreparedContext. Removal target: v2.0.0 after 2026-09-30. */
export type WorkflowPreparedContext = RuntimeWorkflowPreparedContext;
/** @deprecated Use RuntimeWorkflowExecutionResult. Removal target: v2.0.0 after 2026-09-30. */
export type WorkflowExecutionResult = RuntimeWorkflowExecutionResult;
/** @deprecated Use RuntimeWorkflowExecutionRequest. Removal target: v2.0.0 after 2026-09-30. */
export type WorkflowExecutionRequest = RuntimeWorkflowExecutionRequest;
/** @deprecated Use RuntimeTaskMemoryRecord. Removal target: v2.0.0 after 2026-09-30. */
export type TaskMemoryRecord = RuntimeTaskMemoryRecord;
/** @deprecated Use RuntimeMemoryStore. Removal target: v2.0.0 after 2026-09-30. */
export type MemoryStore = RuntimeMemoryStore;
/** @deprecated Use RuntimeTaskRuntimeExecutionRequest. Removal target: v2.0.0 after 2026-09-30. */
export type TaskRuntimeExecutionRequest = RuntimeTaskRuntimeExecutionRequest;
/** @deprecated Use RuntimeAgentRuntimeExecutionOverrides. Removal target: v2.0.0 after 2026-09-30. */
export type AgentRuntimeExecutionOverrides = RuntimeAgentRuntimeExecutionOverrides;
