import { WorkflowStep } from "../../loop/types";

export type LoopBuilderMode = "command" | "workflow";

export type LoopBuilderDraft = {
  mode: LoopBuilderMode;
  cwd: string;
  command: string;
  workflowCarryContext: boolean;
  workflowLoopFromStart: boolean;
  workflowNewSessionPerStep: boolean;
  workflowNewSessionPerRound: boolean;
  workflowSharedSession: boolean;
  workflowFullAccess: boolean;
  workflowSteps: WorkflowStep[];
};
