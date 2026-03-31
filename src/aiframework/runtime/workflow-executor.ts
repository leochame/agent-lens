import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  RuntimeCommandExecutionResult,
  RuntimeToolResult,
  RuntimeWorkflowExecutionRequest,
  RuntimeWorkflowExecutionResult,
  RuntimeWorkflowRunner,
  RuntimeWorkflowStepInput
} from "./contracts";
import { toSafeTaskPathSegment } from "../core/task-id";
import {
  normalizeStepRetryBackoffMs,
  normalizeStepRetryCount,
  normalizeWorkflowRunner
} from "./workflow-normalization";

const STEP_RETRY_BACKOFF_CAP_MS = 60000;

function normalizePrompt(prompt: string): string {
  return String(prompt ?? "").trim();
}

function shellQuoteArg(value: string): string {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function normalizeSpace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function hasCodexAccessFlag(command: string): boolean {
  const normalized = normalizeSpace(command);
  return normalized.includes("--full-auto")
    || normalized.includes("--dangerously-bypass-approvals-and-sandbox");
}

function injectCodexAccessFlag(command: string, fullAccess: boolean): string {
  if (!command || hasCodexAccessFlag(command)) {
    return command;
  }
  const accessFlag = fullAccess
    ? "--dangerously-bypass-approvals-and-sandbox"
    : "--full-auto";
  const resumePrefix = /^(\s*codex\s+exec\s+resume(?:\s+--last)?(?:\s+--all)?)(?=\s|$)/;
  if (resumePrefix.test(command)) {
    return command.replace(resumePrefix, `$1 ${accessFlag}`);
  }
  const execPrefix = /^(\s*codex\s+exec)(?=\s|$)/;
  if (execPrefix.test(command)) {
    return command.replace(execPrefix, `$1 ${accessFlag}`);
  }
  return command;
}

function interpolatePromptTemplate(commandTemplate: string, prompt: string): string {
  const quotedPrompt = shellQuoteArg(prompt);
  return String(commandTemplate)
    .replaceAll('"{prompt}"', quotedPrompt)
    .replaceAll("'{prompt}'", quotedPrompt)
    .replaceAll("{prompt}", quotedPrompt);
}

function buildCommand(runner: RuntimeWorkflowRunner, command: string | null | undefined, prompt: string, fullAccess = false): string {
  if (runner === "openai" || runner === "anthropic") {
    return "";
  }
  if (command) {
    const commandTemplate = String(command);
    const commandWithAccess = injectCodexAccessFlag(commandTemplate, fullAccess);
    return interpolatePromptTemplate(commandWithAccess, prompt);
  }
  if (runner === "claude_code") {
    return `claude -p ${shellQuoteArg(prompt)}`;
  }
  if (runner === "codex") {
    const accessFlag = fullAccess
      ? "--dangerously-bypass-approvals-and-sandbox"
      : "--full-auto";
    return `codex exec ${accessFlag} --skip-git-repo-check ${shellQuoteArg(prompt)}`;
  }
  return "";
}

function isDefaultCodexTemplate(command: string | null | undefined): boolean {
  if (!command) {
    return false;
  }
  const normalized = normalizeSpace(command);
  return normalized === 'codex exec "{prompt}"'
    || normalized === 'codex exec --full-auto "{prompt}"'
    || normalized === 'codex exec --dangerously-bypass-approvals-and-sandbox "{prompt}"';
}

function shouldUseManagedCodexSession(
  task: RuntimeWorkflowExecutionRequest["task"],
  step: RuntimeWorkflowStepInput,
  effectiveRunner: RuntimeWorkflowRunner
): boolean {
  if (!task.workflowSharedSession) {
    return false;
  }
  if (effectiveRunner === "codex" && !step.command && !task.command) {
    return true;
  }
  const candidate = step.command ?? task.command ?? null;
  return isDefaultCodexTemplate(candidate);
}

function buildManagedCodexCommand(prompt: string, resume: boolean, fullAccess: boolean): string {
  const accessFlag = fullAccess
    ? "--dangerously-bypass-approvals-and-sandbox"
    : "--full-auto";
  if (resume) {
    return `codex exec resume --last --all ${accessFlag} --skip-git-repo-check ${shellQuoteArg(prompt)}`;
  }
  return `codex exec ${accessFlag} --skip-git-repo-check ${shellQuoteArg(prompt)}`;
}

function codexSessionHomeForTask(taskId: string): string {
  return join(process.cwd(), ".agentlens", "codex-sessions", toSafeTaskPathSegment(taskId));
}

function buildTaskPrompt(basePrompt: string, stepText: string, stepIndex: number, stepCount: number): string {
  const stepTitle = `[Step ${stepIndex + 1}/${stepCount}] ${stepText}`;
  const cleanBase = normalizePrompt(basePrompt);
  if (!cleanBase) {
    return stepTitle;
  }
  return `${cleanBase}\n\n${stepTitle}`;
}

function computeStepRetryDelayMs(baseDelayMs: number, retryAttempt: number): number {
  const exponent = Math.max(0, retryAttempt - 1);
  const delay = Math.floor(baseDelayMs * (2 ** exponent));
  return Math.max(0, Math.min(delay, STEP_RETRY_BACKOFF_CAP_MS));
}

function isRetryableUpstreamFailure(result: RuntimeCommandExecutionResult): boolean {
  if (result.status === "success" || result.status === "cancelled") {
    return false;
  }
  const merged = `${result.error || ""}\n${result.stderr || ""}\n${result.stdout || ""}`;
  const text = merged.toLowerCase();
  if (!text.trim()) {
    return false;
  }
  const hasNetworkContext = /(http|upstream|gateway|cloudflare|cf-ray|socket|connect|tls|dns|network|econn|enotfound|ehostunreach)/.test(text);
  if (/(^|\b)(http|statuscode|status_code|code)\s*[:=]?\s*[45]\d{2}(\b|$)/i.test(merged) && hasNetworkContext) {
    return true;
  }
  if (/\b(?:4\d{2}|5\d{2})\b/.test(text) && /(http|upstream|gateway|cloudflare|cf-ray)/.test(text)) {
    return true;
  }
  if (/\b(?:timeout|timed out)\b/.test(text) && hasNetworkContext) {
    return true;
  }
  return [
    "cloudflare",
    "cf-ray",
    "upstream",
    "gateway timeout",
    "too many requests",
    "rate limit",
    "network error",
    "socket hang up",
    "etimedout",
    "econnreset",
    "econnrefused",
    "ehostunreach",
    "enotfound",
    "tls handshake",
    "service unavailable",
    "bad gateway"
  ].some((keyword) => text.includes(keyword));
}

function mapToolResult(result: RuntimeToolResult): RuntimeCommandExecutionResult {
  if (result.success) {
    return {
      status: "success",
      exitCode: 0,
      stdout: String(result.output ?? ""),
      stderr: "",
      error: null
    };
  }
  const error = result.error ? String(result.error) : "tool execution failed";
  return {
    status: "failed",
    exitCode: 1,
    stdout: String(result.output ?? ""),
    stderr: error,
    error
  };
}

async function waitForRetryDelay(waitMs: number, isCancelled: () => string | null): Promise<boolean> {
  if (waitMs <= 0) {
    return true;
  }
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    if (isCancelled()) {
      return false;
    }
    const remain = end - Date.now();
    const chunk = Math.max(1, Math.min(remain, 250));
    await new Promise((resolve) => setTimeout(resolve, chunk));
  }
  return true;
}

export class WorkflowExecutor {
  async execute(req: RuntimeWorkflowExecutionRequest): Promise<RuntimeWorkflowExecutionResult> {
    const { task, preparedContext, initialStepIndex, runCommand, resolveStepContext, callbacks } = req;
    const steps = task.workflowSteps;
    if (!Array.isArray(steps) || steps.length === 0) {
      const error = "workflow requires at least one step";
      callbacks.onEvent("error", error);
      return {
        status: "failed",
        exitCode: null,
        error,
        stdout: "",
        stderr: "",
        firstFailure: null
      };
    }

    const normalizedInitialStepIndex = Number.isFinite(initialStepIndex)
      ? Math.floor(initialStepIndex)
      : Number.NaN;
    if (
      !Number.isInteger(normalizedInitialStepIndex)
      || normalizedInitialStepIndex < 0
      || normalizedInitialStepIndex >= steps.length
    ) {
      const error = `invalid initial step index: ${initialStepIndex}; step count=${steps.length}`;
      callbacks.onEvent("error", error);
      return {
        status: "failed",
        exitCode: null,
        error,
        stdout: "",
        stderr: "",
        firstFailure: null
      };
    }

    let mergedStdout = "";
    let mergedStderr = "";
    let finalStatus: RuntimeWorkflowExecutionResult["status"] = "success";
    let finalExitCode: number | null = 0;
    let finalError: string | null = null;
    let firstFailure: RuntimeWorkflowExecutionResult["firstFailure"] = null;
    let codexSharedSessionStarted = false;
    const codexSessionHome = task.workflowSharedSession ? codexSessionHomeForTask(task.id) : null;

    if (codexSessionHome) {
      try {
        await mkdir(codexSessionHome, { recursive: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        finalStatus = "failed";
        finalExitCode = null;
        finalError = `prepare codex session home failed: ${message}`;
        callbacks.onEvent("error", finalError);
        return {
          status: finalStatus,
          exitCode: finalExitCode,
          error: finalError,
          stdout: "",
          stderr: "",
          firstFailure: null
        };
      }
    }

    let round = 1;
    let roundStartStepIdx = normalizedInitialStepIndex;
    let stopAll = false;
    while (!stopAll) {
      let roundHadFailure = false;
      const cancelledReason = callbacks.isCancelled();
      if (cancelledReason) {
        finalStatus = "cancelled";
        finalExitCode = null;
        finalError = cancelledReason;
        callbacks.onEvent("error", finalError);
        break;
      }
      const resumeHint = roundStartStepIdx > 0
        ? ` (resume from step ${roundStartStepIdx + 1}/${steps.length})`
        : "";
      callbacks.onEvent("info", `round ${round} started${resumeHint}`);

      for (let i = roundStartStepIdx; i < steps.length; i += 1) {
        const step = steps[i];
        const stepCancelledReason = callbacks.isCancelled();
        if (stepCancelledReason) {
          finalStatus = "cancelled";
          finalExitCode = null;
          finalError = stepCancelledReason;
          callbacks.onEvent("error", finalError);
          stopAll = true;
          break;
        }

        callbacks.onStepChange(round, i + 1, steps.length, step.name);
        callbacks.onEvent("info", `step ${i + 1}/${steps.length} started: ${step.name}`);

        let stepContext = preparedContext;
        if (step.cwd != null && String(step.cwd).trim()) {
          try {
            stepContext = await resolveStepContext(String(step.cwd), preparedContext.prompt, preparedContext.cwd);
            callbacks.onEvent("info", `step cwd resolved: ${stepContext.cwd}`);
          } catch (error) {
            finalStatus = "failed";
            finalExitCode = null;
            finalError = error instanceof Error ? error.message : String(error);
            callbacks.onEvent("error", finalError);
            stopAll = true;
            break;
          }
        }

        const baseStepPrompt = step.name === "default"
          ? stepContext.prompt
          : buildTaskPrompt(stepContext.prompt, step.name, i, steps.length);
        const stepPrompt = step.promptAppend
          ? `${baseStepPrompt}\n\nStep instruction: ${String(step.promptAppend).trim()}`
          : baseStepPrompt;
        const effectiveRunner = normalizeWorkflowRunner(step.runner ?? task.runner);
        const toolName = step.tool?.name != null ? String(step.tool.name).trim() : "";
        const hasToolField = step.tool != null;
        const isToolStep = !!toolName;
        const useManagedCodex = !isToolStep && shouldUseManagedCodexSession(task, step, effectiveRunner);
        const isModelRunner = effectiveRunner === "openai" || effectiveRunner === "anthropic";
        const executionLabel = isToolStep
          ? `tool:${toolName}`
          : effectiveRunner;
        const cmd = isModelRunner
          ? ""
          : (useManagedCodex
            ? buildManagedCodexCommand(stepPrompt, codexSharedSessionStarted, task.workflowFullAccess)
            : buildCommand(effectiveRunner, step.command ?? task.command, stepPrompt, task.workflowFullAccess));

        if (hasToolField && !isToolStep) {
          finalStatus = "failed";
          finalExitCode = null;
          finalError = `tool step requires non-empty tool name: ${step.name}`;
          callbacks.onEvent("error", finalError);
          stopAll = true;
          break;
        }
        if (isToolStep && !req.runTool) {
          finalStatus = "failed";
          finalExitCode = null;
          finalError = "tool step requires runTool implementation";
          callbacks.onEvent("error", finalError);
          stopAll = true;
          break;
        }
        if (!isModelRunner && !isToolStep && !cmd) {
          finalStatus = "failed";
          finalExitCode = null;
          finalError = "empty command; set command for task or step";
          callbacks.onEvent("error", finalError);
          stopAll = true;
          break;
        }
        if (!isToolStep && isModelRunner && !req.runModel) {
          finalStatus = "failed";
          finalExitCode = null;
          finalError = `runner ${effectiveRunner} requires runModel implementation`;
          callbacks.onEvent("error", finalError);
          stopAll = true;
          break;
        }
        callbacks.onEvent("info", `step ${i + 1}/${steps.length} executing (runner=${executionLabel}, timeout=disabled)`);

        const stepEnv = useManagedCodex && codexSessionHome
          ? { CODEX_HOME: codexSessionHome }
          : undefined;
        const retryCount = normalizeStepRetryCount(step.retryCount);
        const retryBackoffMs = normalizeStepRetryBackoffMs(step.retryBackoffMs);
        let retryAttempt = 0;
        let stepResult: RuntimeCommandExecutionResult = {
          status: "failed",
          exitCode: null,
          stdout: "",
          stderr: "",
          error: "step execution was not started"
        };
        let stepStdoutMerged = "";
        let stepStderrMerged = "";

        while (true) {
          const currentAttempt = retryAttempt + 1;
          if (currentAttempt > 1) {
            callbacks.onEvent("info", `step ${i + 1}/${steps.length} retry attempt ${currentAttempt}/${retryCount + 1} started`);
          }
          let result: RuntimeCommandExecutionResult;
          if (isToolStep) {
            try {
              result = mapToolResult(
                await req.runTool!({
                  name: toolName,
                  input: step.tool?.input,
                  cwd: stepContext.cwd,
                  stepName: step.name
                })
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              result = {
                status: "failed",
                exitCode: null,
                stdout: "",
                stderr: message,
                error: message
              };
            }
          } else if (isModelRunner) {
            try {
              result = await req.runModel!(effectiveRunner, stepPrompt, stepContext.cwd);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              result = {
                status: "failed",
                exitCode: null,
                stdout: "",
                stderr: message,
                error: message
              };
            }
          } else {
            result = await runCommand(
              cmd,
              stepContext.cwd,
              0,
              stepEnv,
              {
                cancellationReason: callbacks.isCancelled,
                onChunk: callbacks.onOutput,
                onHeartbeat: callbacks.onHeartbeat
              }
            );
          }

          if ((isToolStep || isModelRunner) && result.stdout) {
            callbacks.onOutput("stdout", result.stdout);
          }
          if ((isToolStep || isModelRunner) && result.stderr) {
            callbacks.onOutput("stderr", result.stderr);
          }

          stepStdoutMerged += `[attempt ${currentAttempt}/${retryCount + 1}]\n${result.stdout}\n`;
          stepStderrMerged += `[attempt ${currentAttempt}/${retryCount + 1}]\n${result.stderr}\n`;

          const shouldRetry = retryAttempt < retryCount && isRetryableUpstreamFailure(result);
          if (!shouldRetry) {
            stepResult = result;
            break;
          }

          const waitMs = computeStepRetryDelayMs(retryBackoffMs, currentAttempt);
          callbacks.onEvent("info", `step ${i + 1}/${steps.length} hit retryable upstream/network failure, retry in ${waitMs}ms`);
          const continueRetry = await waitForRetryDelay(waitMs, callbacks.isCancelled);
          if (!continueRetry) {
            stepResult = {
              status: "cancelled",
              exitCode: null,
              stdout: result.stdout,
              stderr: result.stderr,
              error: callbacks.isCancelled() || "retry wait cancelled"
            };
            break;
          }
          retryAttempt += 1;
        }

        if (useManagedCodex && stepResult.status === "success") {
          codexSharedSessionStarted = true;
        }

        mergedStdout += `[round ${round}] [step ${i + 1}/${steps.length}] ${step.name} (runner=${executionLabel}, timeout=disabled)\n${stepStdoutMerged}\n`;
        mergedStderr += `[round ${round}] [step ${i + 1}/${steps.length}] ${step.name} (runner=${executionLabel}, timeout=disabled)\n${stepStderrMerged}\n`;

        if (stepResult.status !== "success") {
          roundHadFailure = true;
          callbacks.onEvent("error", `step ${i + 1}/${steps.length} ended with ${stepResult.status} (exit=${stepResult.exitCode == null ? "-" : stepResult.exitCode})`);
          if (!firstFailure) {
            firstFailure = {
              result: stepResult,
              round,
              stepIndex: i + 1,
              stepCount: steps.length,
              stepName: step.name
            };
          }
          if (step.continueOnError) {
            callbacks.onEvent("info", `step ${i + 1}/${steps.length} continueOnError=true, move on`);
            mergedStderr += `[round ${round}] [step ${i + 1}/${steps.length}] continue on error enabled, moving to next step\n`;
            continue;
          }
          finalStatus = stepResult.status;
          finalExitCode = stepResult.exitCode;
          finalError = stepResult.error;
          stopAll = true;
          break;
        }

        callbacks.onEvent("info", `step ${i + 1}/${steps.length} completed successfully`);
        finalExitCode = stepResult.exitCode;
      }

      if (roundHadFailure) {
        callbacks.onEvent("info", `round ${round} completed with failure(s), stopping loop`);
        break;
      }
      if (!task.workflowLoopFromStart || stopAll) {
        break;
      }

      const stopAfterRoundReason = callbacks.stopAfterRoundReason();
      if (stopAfterRoundReason) {
        finalStatus = "cancelled";
        finalExitCode = 0;
        finalError = stopAfterRoundReason;
        callbacks.onEvent("info", `round ${round} completed, stop requested after current round`);
        break;
      }

      callbacks.onEvent("info", `round ${round} completed, loop from start enabled`);
      roundStartStepIdx = 0;
      round += 1;
    }

    if (!finalError && firstFailure) {
      const first = firstFailure.result;
      finalStatus = first.status;
      finalExitCode = first.exitCode;
      const explicit = first.error ? String(first.error).trim() : "";
      const stderrTail = String(first.stderr || "").trim().slice(-240);
      const location = `first failure at round ${firstFailure.round}, step ${firstFailure.stepIndex}/${firstFailure.stepCount} (${firstFailure.stepName})`;
      const statusLine = `status=${first.status}, exit=${first.exitCode == null ? "-" : first.exitCode}`;
      if (explicit) {
        finalError = `${location}: ${statusLine}; error=${explicit}`;
      } else if (stderrTail) {
        finalError = `${location}: ${statusLine}; stderr=${stderrTail}`;
      } else {
        finalError = `${location}: ${statusLine}; one or more steps failed but execution continued`;
      }
    }

    return {
      status: finalStatus,
      exitCode: finalExitCode,
      error: finalError,
      stdout: mergedStdout.slice(0, 20000),
      stderr: mergedStderr.slice(0, 20000),
      firstFailure
    };
  }
}
