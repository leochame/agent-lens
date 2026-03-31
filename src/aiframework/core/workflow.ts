import type {
  RuntimeAgentRuntimeExecutionOverrides,
  RuntimeCommandExecutionHooks,
  RuntimeCommandExecutionResult,
  RuntimeCommandExecutionStatus,
  RuntimeCommandRunner,
  RuntimeResolveStepContext,
  RuntimeRunCommand,
  RuntimeRunModel,
  RuntimeRunTool,
  RuntimeTaskRuntimeExecutionRequest,
  RuntimeWorkflowExecutionCallbacks,
  RuntimeWorkflowExecutionFirstFailure,
  RuntimeWorkflowExecutionRequest,
  RuntimeWorkflowExecutionResult,
  RuntimeWorkflowPreparedContext,
  RuntimeWorkflowRunner,
  RuntimeWorkflowStepInput,
  RuntimeWorkflowTaskInput
} from "../runtime/contracts";

// Legacy facade: keep core workflow contract names as thin aliases.
// Single source of truth is runtime/contracts.
export type CommandExecutionStatus = RuntimeCommandExecutionStatus;
export type CommandExecutionResult = RuntimeCommandExecutionResult;
export type CommandExecutionHooks = RuntimeCommandExecutionHooks;
export type CommandRunner = RuntimeCommandRunner;

export type WorkflowRunner = RuntimeWorkflowRunner;
export type WorkflowStepInput = RuntimeWorkflowStepInput;
export type WorkflowTaskInput = RuntimeWorkflowTaskInput;

export type WorkflowPreparedContext = RuntimeWorkflowPreparedContext;
export type WorkflowExecutionCallbacks = RuntimeWorkflowExecutionCallbacks;
export type WorkflowExecutionRequest = RuntimeWorkflowExecutionRequest;

export type WorkflowFirstFailure = RuntimeWorkflowExecutionFirstFailure;
export type WorkflowExecutionResult = RuntimeWorkflowExecutionResult;

// Kept for transitional parity with runtime naming.
export type TaskRuntimeExecutionRequest = RuntimeTaskRuntimeExecutionRequest;
export type AgentRuntimeExecutionOverrides = RuntimeAgentRuntimeExecutionOverrides;
export type ResolveStepContext = RuntimeResolveStepContext;
export type RunCommand = RuntimeRunCommand;
export type RunModel = RuntimeRunModel;
export type RunTool = RuntimeRunTool;
