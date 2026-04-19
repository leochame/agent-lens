export type LoopRunner = "claude_code" | "codex" | "custom" | "openai" | "anthropic";

export type WorkflowStep = {
  name: string;
  runner?: LoopRunner;
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

export type WorkflowStepInputCompat = WorkflowStep & {
  // Legacy compatibility field accepted only at scheduler input layer.
  timeoutSec?: number;
};

export type LoopTask = {
  id: string;
  name: string;
  runner: LoopRunner;
  prompt: string;
  workflow: string[];
  workflowSteps: WorkflowStep[];
  workflowCarryContext: boolean;
  workflowLoopFromStart: boolean;
  workflowSharedSession: boolean;
  workflowFullAccess: boolean;
  workflowResumeStepIndex: number | null;
  workflowResumeUpdatedAt: string | null;
  workflowResumeReason: string | null;
  intervalSec: number;
  // Legacy compatibility field. Runtime does not enforce task timeout.
  timeoutSec: number;
  enabled: boolean;
  cwd: string | null;
  command: string | null;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
};

export type LoopRun = {
  id: string;
  taskId: string;
  taskName: string;
  runner: LoopRunner;
  trigger: "timer" | "manual";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "failed" | "timeout" | "cancelled";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error: string | null;
};

export type LoopRunLiveEvent = {
  at: string;
  level: "info" | "error";
  message: string;
};

export type LoopRunLive = {
  id: string;
  taskId: string;
  taskName: string;
  runner: LoopRunner;
  trigger: "timer" | "manual";
  startedAt: string;
  heartbeatAt: string;
  silenceSec: number;
  heartbeatStale: boolean;
  phase: "preparing" | "running" | "finishing";
  round: number;
  stepIndex: number;
  totalSteps: number;
  stepName: string | null;
  events: LoopRunLiveEvent[];
  stdoutTail: string;
  stderrTail: string;
};

export type CreateLoopTaskInput = {
  name: string;
  runner: LoopRunner;
  prompt: string;
  workflow?: string[] | string;
  workflowSteps?: WorkflowStepInputCompat[] | string;
  workflowCarryContext?: boolean;
  workflowLoopFromStart?: boolean;
  workflowSharedSession?: boolean;
  workflowFullAccess?: boolean;
  intervalSec: number;
  // Legacy compatibility field. Accepted but ignored by runtime.
  timeoutSec?: number;
  enabled?: boolean;
  cwd?: string | null;
  command?: string | null;
};

export type UpdateLoopTaskInput = Partial<Omit<CreateLoopTaskInput, "runner">> & {
  runner?: LoopRunner;
};
