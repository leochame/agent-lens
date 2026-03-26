export type LoopRunner = "claude_code" | "codex" | "custom";

export type WorkflowStep = {
  name: string;
  runner?: LoopRunner;
  cwd?: string | null;
  command?: string | null;
  promptAppend?: string;
  timeoutSec?: number;
  continueOnError?: boolean;
  enabled?: boolean;
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
  intervalSec: number;
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
  status: "success" | "failed" | "timeout";
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
  workflowSteps?: WorkflowStep[] | string;
  workflowCarryContext?: boolean;
  workflowLoopFromStart?: boolean;
  workflowSharedSession?: boolean;
  workflowFullAccess?: boolean;
  intervalSec: number;
  timeoutSec?: number;
  enabled?: boolean;
  cwd?: string | null;
  command?: string | null;
};

export type UpdateLoopTaskInput = Partial<Omit<CreateLoopTaskInput, "runner">> & {
  runner?: LoopRunner;
};
