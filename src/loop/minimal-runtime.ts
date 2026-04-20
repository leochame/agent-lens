import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { LoopFileMemoryStore } from "./file-memory-store";
import { createLoopModelClient, LoopModelClient, LoopModelProvider } from "./model-runtime";
import {
  LoopRunner,
  WorkflowStep
} from "./types";
import { normalizeStepRetryBackoffMs, normalizeStepRetryCount, normalizeWorkflowRunner } from "./task-normalization";
import { LoopToolRegistry } from "./tool-registry";

export type LoopCommandExecutionStatus = "success" | "failed" | "timeout" | "cancelled";

export type LoopCommandExecutionHooks = {
  onSpawn?: (child: ChildProcessWithoutNullStreams) => void;
  cancellationReason?: () => string | null;
  onChunk?: (stream: "stdout" | "stderr", chunk: string) => void;
  onHeartbeat?: () => void;
};

export type LoopCommandExecutionResult = {
  status: LoopCommandExecutionStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error: string | null;
};

export type LoopRuntimeExecutionFirstFailure = {
  result: LoopCommandExecutionResult;
  round: number;
  stepIndex: number;
  stepCount: number;
  stepName: string;
};

export type LoopRuntimeExecutionResult = {
  status: LoopCommandExecutionStatus;
  exitCode: number | null;
  error: string | null;
  stdout: string;
  stderr: string;
  firstFailure: LoopRuntimeExecutionFirstFailure | null;
};

export type LoopResolveStepContext = (
  cwdInput: string,
  prompt: string,
  baseCwd: string
) => Promise<{ cwd: string; prompt: string }>;

export type LoopRunCommand = (
  command: string,
  cwd: string,
  timeoutSec: number,
  envPatch?: Record<string, string>,
  hooks?: LoopCommandExecutionHooks
) => Promise<LoopCommandExecutionResult>;

export type LoopRuntimeExecutionOverrides = {
  runCommand?: LoopRunCommand;
  runModel?: (
    provider: "openai" | "anthropic",
    prompt: string,
    cwd: string
  ) => Promise<LoopCommandExecutionResult>;
  runTool?: (call: {
    name: string;
    input?: unknown;
    cwd: string;
    stepName: string;
  }) => Promise<{ success: boolean; output: string; error: string | null }>;
  resolveStepContext?: LoopResolveStepContext;
};

type LoopRuntimeTaskInput = {
  id: string;
  runner: LoopRunner;
  prompt: string;
  command: string | null;
  workflowSteps: WorkflowStep[];
  workflowCarryContext: boolean;
  workflowLoopFromStart: boolean;
  workflowNewSessionPerStep?: boolean;
  workflowNewSessionPerRound?: boolean;
  workflowSharedSession: boolean;
  workflowFullAccess: boolean;
};

type ExecuteTaskInput = {
  task: LoopRuntimeTaskInput;
  cwdInput: string | null;
  initialStepIndex: number;
  onCommandSpawn?: (child: ChildProcessWithoutNullStreams) => void;
  callbacks: {
    onEvent: (level: "info" | "error", message: string) => void;
    onStepChange: (round: number, stepIndex: number, totalSteps: number, stepName: string | null) => void;
    onOutput: (stream: "stdout" | "stderr", chunk: string) => void;
    onHeartbeat: () => void;
    isCancelled: () => string | null;
    stopAfterRoundReason: () => string | null;
  };
} & LoopRuntimeExecutionOverrides;

function shellQuoteArg(value: string): string {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function normalizePrompt(prompt: string): string {
  return String(prompt ?? "").trim();
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

function buildCommand(runner: LoopRunner, command: string | null | undefined, prompt: string, fullAccess = false): string {
  if (runner === "openai" || runner === "anthropic") {
    return "";
  }
  if (command) {
    const commandTemplate = injectCodexAccessFlag(String(command), fullAccess);
    return interpolatePromptTemplate(commandTemplate, prompt);
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
  if (runner === "custom") {
    return "";
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

function isManagedCodexTemplate(command: string | null | undefined): boolean {
  if (!command) {
    return false;
  }
  const normalized = normalizeSpace(command);
  if (!normalized.startsWith("codex exec ")) {
    return false;
  }
  if (normalized.startsWith("codex exec resume ")) {
    return false;
  }
  return normalized.includes("{prompt}");
}

function shouldUseManagedCodexSession(
  task: LoopRuntimeTaskInput,
  step: WorkflowStep,
  runner: LoopRunner
): boolean {
  if (task.workflowNewSessionPerStep) {
    return false;
  }
  if (runner === "codex" && !step.command && !task.command) {
    return true;
  }
  const candidate = step.command ?? task.command ?? null;
  return isManagedCodexTemplate(candidate);
}

function buildManagedCodexCommand(
  prompt: string,
  resume: boolean,
  fullAccess: boolean,
  commandTemplate?: string | null
): string {
  if (!commandTemplate || isDefaultCodexTemplate(commandTemplate)) {
    const accessFlag = fullAccess
      ? "--dangerously-bypass-approvals-and-sandbox"
      : "--full-auto";
    if (resume) {
      return `codex exec resume --last --all ${accessFlag} --skip-git-repo-check ${shellQuoteArg(prompt)}`;
    }
    return `codex exec ${accessFlag} --skip-git-repo-check ${shellQuoteArg(prompt)}`;
  }
  let next = injectCodexAccessFlag(String(commandTemplate), fullAccess);
  if (resume) {
    next = next.replace(/^(\s*codex\s+exec)(?=\s|$)/, "$1 resume --last --all");
  }
  return interpolatePromptTemplate(next, prompt);
}

function buildWorkflowStepPrompt(basePrompt: string, step: WorkflowStep, _stepIndex: number, _stepCount: number): string {
  const stepName = String(step.name ?? "").trim();
  const promptAppend = step.promptAppend ? String(step.promptAppend).trim() : "";
  const cleanBase = normalizePrompt(basePrompt);
  const stepParts: string[] = [];
  if (stepName && stepName !== "default") {
    stepParts.push(stepName);
  }
  if (promptAppend) {
    stepParts.push(promptAppend);
  }
  if (!stepParts.length) {
    return cleanBase;
  }
  if (!cleanBase) {
    return stepParts.join("\n\n");
  }
  return `${cleanBase}\n\n${stepParts.join("\n\n")}`;
}

function toSafeTaskPathSegment(taskId: string): string {
  return String(taskId || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "task";
}

function codexSessionHomeForTask(taskId: string, round: number): string {
  const base = join(process.cwd(), ".agentlens", "codex-sessions", toSafeTaskPathSegment(taskId));
  if (round <= 1) {
    return base;
  }
  return join(base, `round-${String(round)}`);
}

function mapToolResult(result: { success: boolean; output: string; error: string | null }): LoopCommandExecutionResult {
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

function isRetryableUpstreamFailure(result: LoopCommandExecutionResult): boolean {
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

async function defaultResolveStepContext(cwdInput: string, prompt: string, baseCwd: string): Promise<{ cwd: string; prompt: string }> {
  const trimmed = String(cwdInput || "").trim();
  if (!trimmed) {
    return { cwd: baseCwd, prompt };
  }
  const resolvedPath = isAbsolute(trimmed) ? trimmed : resolve(baseCwd, trimmed);
  let s;
  try {
    s = await stat(resolvedPath);
  } catch {
    throw new Error(`path not found: ${trimmed}`);
  }
  if (s.isDirectory()) {
    return { cwd: resolvedPath, prompt };
  }
  if (s.isFile()) {
    return {
      cwd: dirname(resolvedPath),
      prompt: `${prompt}\n\nTarget file: ${resolvedPath}`
    };
  }
  throw new Error(`path must be a directory or file: ${trimmed}`);
}

async function runShellCommand(
  command: string,
  cwd: string,
  timeoutSec: number,
  envPatch?: Record<string, string>,
  hooks?: LoopCommandExecutionHooks
): Promise<LoopCommandExecutionResult> {
  return new Promise<LoopCommandExecutionResult>((resolveResult) => {
    const child = spawn("/bin/zsh", ["-lc", command], {
      cwd,
      detached: true,
      env: { ...process.env, ...(envPatch || {}) },
      stdio: ["pipe", "pipe", "pipe"]
    });

    hooks?.onSpawn?.(child);

    let stdout = "";
    let stderr = "";
    let settled = false;
    let killedByCancel = false;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let cancelTimer: NodeJS.Timeout | null = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let forceKillTimer: NodeJS.Timeout | null = null;

    const clearTimers = (): void => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }
      if (cancelTimer) {
        clearInterval(cancelTimer);
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    };

    const finalize = (result: LoopCommandExecutionResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimers();
      resolveResult(result);
    };

    const append = (stream: "stdout" | "stderr", chunk: Buffer): void => {
      const text = chunk.toString("utf8");
      if (!text) {
        return;
      }
      if (stream === "stdout") {
        stdout = `${stdout}${text}`;
      } else {
        stderr = `${stderr}${text}`;
      }
      hooks?.onChunk?.(stream, text);
      hooks?.onHeartbeat?.();
    };

    child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));

    if (timeoutSec > 0 && Number.isFinite(timeoutSec)) {
      timeoutHandle = setTimeout(() => {
        if (!child.pid) {
          return;
        }
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {}
        forceKillTimer = setTimeout(() => {
          if (!child.pid) {
            return;
          }
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {}
        }, 1500);
      }, timeoutSec * 1000);
    }

    cancelTimer = setInterval(() => {
      const reason = hooks?.cancellationReason?.() || null;
      if (!reason) {
        return;
      }
      killedByCancel = true;
      if (!child.pid) {
        return;
      }
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
      forceKillTimer = setTimeout(() => {
        if (!child.pid) {
          return;
        }
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      }, 1500);
    }, 250);

    heartbeatTimer = setInterval(() => {
      hooks?.onHeartbeat?.();
    }, 1000);

    child.on("error", (error) => {
      finalize({
        status: "failed",
        exitCode: null,
        stdout,
        stderr,
        error: error.message
      });
    });

    const finalizeWithCode = (code: number | null, signal: NodeJS.Signals | null): void => {
      const cancellationReason = hooks?.cancellationReason?.() || null;
      if (killedByCancel || cancellationReason) {
        const reason = cancellationReason || "task cancelled";
        finalize({
          status: "cancelled",
          exitCode: code,
          stdout,
          stderr,
          error: reason
        });
        return;
      }
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        const timedOut = timeoutSec > 0 && !hooks?.cancellationReason?.();
        finalize({
          status: timedOut ? "timeout" : "failed",
          exitCode: code,
          stdout,
          stderr,
          error: timedOut ? "command timeout" : (stderr.trim() || "process terminated")
        });
        return;
      }
      if (code === 0) {
        finalize({ status: "success", exitCode: 0, stdout, stderr, error: null });
        return;
      }
      finalize({
        status: "failed",
        exitCode: code,
        stdout,
        stderr,
        error: stderr.trim() || `command exited with code ${String(code)}`
      });
    };

    child.on("close", (code, signal) => {
      finalizeWithCode(code, signal);
    });
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class MinimalLoopRuntime {
  private readonly memoryStore: LoopFileMemoryStore;
  private readonly toolRegistry: LoopToolRegistry;
  private readonly modelClients: Map<LoopModelProvider, LoopModelClient>;

  constructor(options?: {
    memoryStore?: LoopFileMemoryStore;
    toolRegistry?: LoopToolRegistry;
  }) {
    this.memoryStore = options?.memoryStore ?? new LoopFileMemoryStore();
    this.toolRegistry = options?.toolRegistry ?? new LoopToolRegistry();
    this.modelClients = new Map();
  }

  async inspectPath(rawPath: string, baseCwd: string | null): Promise<{ path: string; kind: "directory" | "file"; runCwd: string; promptHint: string | null }> {
    const input = String(rawPath || "").trim();
    if (!input) {
      throw new Error("path is required");
    }
    const origin = baseCwd || process.cwd();
    const absPath = isAbsolute(input) ? input : resolve(origin, input);
    let s;
    try {
      s = await stat(absPath);
    } catch {
      throw new Error(`path not found: ${input}`);
    }
    if (s.isDirectory()) {
      return { path: absPath, kind: "directory", runCwd: absPath, promptHint: null };
    }
    if (s.isFile()) {
      return {
        path: absPath,
        kind: "file",
        runCwd: dirname(absPath),
        promptHint: `Target file: ${absPath}`
      };
    }
    throw new Error(`path must be a directory or file: ${input}`);
  }

  async validateWorkflowStepPaths(workflowSteps: WorkflowStep[], taskRunCwd: string | null): Promise<void> {
    const base = taskRunCwd || process.cwd();
    for (const step of workflowSteps) {
      const cwdInput = step && step.cwd != null ? String(step.cwd).trim() : "";
      if (!cwdInput) {
        continue;
      }
      try {
        await this.inspectPath(cwdInput, base);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stepName = step.name ? String(step.name) : "(unnamed)";
        throw new Error(`workflow step "${stepName}" cwd invalid: ${message}`);
      }
    }
  }

  async executeTask(req: ExecuteTaskInput): Promise<LoopRuntimeExecutionResult> {
    const resolveStepContext = req.resolveStepContext || defaultResolveStepContext;
    const runCommand = req.runCommand || runShellCommand;
    const runModel = req.runModel || ((provider, prompt, cwd) => this.executeModel(provider, prompt, cwd));
    const runTool = req.runTool || ((call) => this.executeTool(call));
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

    const baseContext = req.cwdInput && String(req.cwdInput).trim()
      ? await resolveStepContext(String(req.cwdInput), taskPrompt, process.cwd())
      : { cwd: process.cwd(), prompt: taskPrompt };

    req.callbacks.onEvent("info", `resolved execution cwd: ${baseContext.cwd}`);

    const finalizeResult = async (result: LoopRuntimeExecutionResult): Promise<LoopRuntimeExecutionResult> => {
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
    };

    const steps = req.task.workflowSteps;
    const startIndex = Number.isFinite(req.initialStepIndex) ? Math.max(0, Math.floor(req.initialStepIndex)) : 0;
    if (!Array.isArray(steps) || steps.length === 0) {
      return {
        status: "failed",
        exitCode: null,
        error: "workflow requires at least one step",
        stdout: "",
        stderr: "",
        firstFailure: null
      };
    }
    if (startIndex >= steps.length) {
      return {
        status: "failed",
        exitCode: null,
        error: `invalid initial step index: ${req.initialStepIndex}; step count=${steps.length}`,
        stdout: "",
        stderr: "",
        firstFailure: null
      };
    }

    let mergedStdout = "";
    let mergedStderr = "";
    let status: LoopCommandExecutionStatus = "success";
    let exitCode: number | null = 0;
    let error: string | null = null;
    let firstFailure: LoopRuntimeExecutionFirstFailure | null = null;
    let codexSharedSessionStarted = false;
    let round = 1;
    let roundStart = startIndex;
    while (true) {
      if (req.task.workflowNewSessionPerRound) {
        codexSharedSessionStarted = false;
      }
      const codexSessionHome = req.task.workflowNewSessionPerStep
        ? null
        : codexSessionHomeForTask(req.task.id, req.task.workflowNewSessionPerRound ? round : 1);

      if (codexSessionHome) {
        await mkdir(codexSessionHome, { recursive: true });
      }
      let roundHadFailure = false;
      req.callbacks.onEvent("info", `round ${round} started`);
      for (let i = roundStart; i < steps.length; i += 1) {
        const step = steps[i];
        req.callbacks.onStepChange(round, i + 1, steps.length, step.name || null);

        const cancelled = req.callbacks.isCancelled();
        if (cancelled) {
          return finalizeResult({
            status: "cancelled",
            exitCode: null,
            error: cancelled,
            stdout: mergedStdout,
            stderr: mergedStderr,
            firstFailure
          });
        }

        const runner = normalizeWorkflowRunner(step.runner ?? req.task.runner);
        const stepCtx = step.cwd && String(step.cwd).trim()
          ? await resolveStepContext(String(step.cwd), baseContext.prompt, baseContext.cwd)
          : baseContext;

        const stepPrompt = buildWorkflowStepPrompt(stepCtx.prompt, step, i, steps.length);
        const toolName = step.tool?.name != null ? String(step.tool.name).trim() : "";
        const hasToolField = step.tool != null;
        const isToolStep = !!toolName;
        const isModelRunner = runner === "openai" || runner === "anthropic";
        const useManagedCodex = !isToolStep && shouldUseManagedCodexSession(req.task, step, runner);
        const commandTemplate = step.command ?? req.task.command;
        const command = isModelRunner
          ? ""
          : (useManagedCodex
            ? buildManagedCodexCommand(stepPrompt, codexSharedSessionStarted, req.task.workflowFullAccess, commandTemplate)
            : buildCommand(runner, commandTemplate, stepPrompt, req.task.workflowFullAccess));

        if (hasToolField && !isToolStep) {
          const toolNameError = `tool step requires non-empty tool name: ${step.name || "step"}`;
          return finalizeResult({
            status: "failed",
            exitCode: null,
            error: toolNameError,
            stdout: mergedStdout,
            stderr: mergedStderr,
            firstFailure: firstFailure || {
              result: { status: "failed", exitCode: null, stdout: "", stderr: "", error: toolNameError },
              round,
              stepIndex: i + 1,
              stepCount: steps.length,
              stepName: step.name || "step"
            }
          });
        }
        if (!isModelRunner && !isToolStep && !command) {
          const noCommandError = "command is required";
          return finalizeResult({
            status: "failed",
            exitCode: null,
            error: noCommandError,
            stdout: mergedStdout,
            stderr: mergedStderr,
            firstFailure: firstFailure || {
              result: { status: "failed", exitCode: null, stdout: "", stderr: "", error: noCommandError },
              round,
              stepIndex: i + 1,
              stepCount: steps.length,
              stepName: step.name || "step"
            }
          });
        }

        const retryMax = normalizeStepRetryCount(step.retryCount);
        const retryBackoff = normalizeStepRetryBackoffMs(step.retryBackoffMs);
        let attempt = 0;
        let result: LoopCommandExecutionResult | null = null;
        let stepStdoutMerged = "";
        let stepStderrMerged = "";
        const stepEnv = useManagedCodex && codexSessionHome
          ? { CODEX_HOME: codexSessionHome }
          : undefined;

        while (attempt <= retryMax) {
          attempt += 1;
          req.callbacks.onEvent("info", `step ${i + 1}/${steps.length} running: ${step.name || "step"}`);
          if (isToolStep) {
            result = mapToolResult(await runTool!({
              name: toolName,
              input: step.tool?.input,
              cwd: stepCtx.cwd,
              stepName: step.name || "step"
            }));
            if (result.stdout) {
              req.callbacks.onOutput("stdout", result.stdout);
            }
            if (result.stderr) {
              req.callbacks.onOutput("stderr", result.stderr);
            }
          } else if (isModelRunner) {
            result = await runModel!(runner, stepPrompt, stepCtx.cwd);
            if (result.stdout) {
              req.callbacks.onOutput("stdout", result.stdout);
            }
            if (result.stderr) {
              req.callbacks.onOutput("stderr", result.stderr);
            }
          } else {
            result = await runCommand(command, stepCtx.cwd, 0, stepEnv, {
              onSpawn: req.onCommandSpawn,
              cancellationReason: req.callbacks.isCancelled,
              onChunk: req.callbacks.onOutput,
              onHeartbeat: req.callbacks.onHeartbeat
            });
          }

          stepStdoutMerged += `[attempt ${attempt}/${retryMax + 1}]\n${result.stdout}\n`;
          stepStderrMerged += `[attempt ${attempt}/${retryMax + 1}]\n${result.stderr}\n`;

          if (result.status === "success" || result.status === "cancelled" || attempt > retryMax) {
            break;
          }
          if (!isRetryableUpstreamFailure(result)) {
            break;
          }
          await sleep(retryBackoff * Math.max(1, attempt - 1));
        }

        if (!result) {
          result = {
            status: "failed",
            exitCode: null,
            stdout: "",
            stderr: "",
            error: "empty execution result"
          };
        }

        mergedStdout += `[round ${round}] [step ${i + 1}/${steps.length}] ${step.name || "step"}\n${stepStdoutMerged}\n`;
        mergedStderr += `[round ${round}] [step ${i + 1}/${steps.length}] ${step.name || "step"}\n${stepStderrMerged}\n`;

        if (result.status === "success") {
          if (useManagedCodex) {
            codexSharedSessionStarted = true;
          }
          req.callbacks.onEvent("info", `step ${i + 1}/${steps.length} succeeded`);
          continue;
        }

        if (!firstFailure) {
          firstFailure = {
            result,
            round,
            stepIndex: i + 1,
            stepCount: steps.length,
            stepName: step.name || "step"
          };
        }

        if (result.status === "cancelled") {
          return finalizeResult({
            status: "cancelled",
            exitCode: result.exitCode,
            error: result.error,
            stdout: mergedStdout,
            stderr: mergedStderr,
            firstFailure
          });
        }

        roundHadFailure = true;
        if (step.continueOnError) {
          req.callbacks.onEvent("error", `step ${i + 1}/${steps.length} failed but continueOnError=true`);
          continue;
        }

        status = result.status;
        exitCode = result.exitCode;
        error = result.error || `step failed: ${step.name || "step"}`;
        return finalizeResult({
          status,
          exitCode,
          error,
          stdout: mergedStdout,
          stderr: mergedStderr,
          firstFailure
        });
      }

      const stopAfterRound = req.callbacks.stopAfterRoundReason();
      if (roundHadFailure) {
        if (stopAfterRound) {
          req.callbacks.onEvent("info", `round ${round} completed with failure(s), stop requested after current round`);
          return finalizeResult({
            status: "cancelled",
            exitCode: null,
            error: stopAfterRound,
            stdout: mergedStdout,
            stderr: mergedStderr,
            firstFailure
          });
        }
        req.callbacks.onEvent("info", `round ${round} completed with failure(s), stopping loop`);
        break;
      }

      if (stopAfterRound) {
        return finalizeResult({
          status: "cancelled",
          exitCode: null,
          error: stopAfterRound,
          stdout: mergedStdout,
          stderr: mergedStderr,
          firstFailure
        });
      }

      if (!req.task.workflowLoopFromStart) {
        break;
      }

      round += 1;
      roundStart = 0;
    }

    if (!error && firstFailure) {
      const first = firstFailure.result;
      status = first.status;
      exitCode = first.exitCode;
      const explicit = first.error ? String(first.error).trim() : "";
      const stderrTail = String(first.stderr || "").trim().slice(-240);
      const location = `first failure at round ${firstFailure.round}, step ${firstFailure.stepIndex}/${firstFailure.stepCount} (${firstFailure.stepName})`;
      const statusLine = `status=${first.status}, exit=${first.exitCode == null ? "-" : first.exitCode}`;
      if (explicit) {
        error = `${location}: ${statusLine}; error=${explicit}`;
      } else if (stderrTail) {
        error = `${location}: ${statusLine}; stderr=${stderrTail}`;
      } else {
        error = `${location}: ${statusLine}; one or more steps failed but execution continued`;
      }
    }

    const result = {
      status,
      exitCode,
      error,
      stdout: mergedStdout,
      stderr: mergedStderr,
      firstFailure
    } satisfies LoopRuntimeExecutionResult;

    return finalizeResult(result);
  }

  async executeModel(provider: LoopModelProvider, prompt: string, _cwd: string): Promise<LoopCommandExecutionResult> {
    try {
      const client = this.getModelClient(provider);
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

  executeTool(call: {
    name: string;
    input?: unknown;
    cwd: string;
    stepName: string;
  }): Promise<{ success: boolean; output: string; error: string | null }> {
    return this.toolRegistry.execute(call).then((result) => ({
      success: !!result.success,
      output: String(result.output ?? ""),
      error: result.error ? String(result.error) : null
    }));
  }

  private getModelClient(provider: LoopModelProvider): LoopModelClient {
    const cached = this.modelClients.get(provider);
    if (cached) {
      return cached;
    }
    const client = createLoopModelClient(provider);
    this.modelClients.set(provider, client);
    return client;
  }
}
