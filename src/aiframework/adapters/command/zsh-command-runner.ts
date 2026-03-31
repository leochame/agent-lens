import { spawn } from "node:child_process";
import { CommandExecutionHooks, CommandExecutionResult, CommandRunner } from "../../core/workflow";

export class ZshCommandRunner implements CommandRunner {
  async run(
    command: string,
    cwd: string,
    timeoutSec: number,
    envPatch?: Record<string, string>,
    hooks?: CommandExecutionHooks
  ): Promise<CommandExecutionResult> {
    return new Promise<CommandExecutionResult>((resolveResult) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timeoutTriggered = false;
      let forceKillTimer: NodeJS.Timeout | null = null;
      const timeoutMs = Number.isFinite(timeoutSec) && timeoutSec > 0
        ? Math.floor(timeoutSec * 1000)
        : 0;

      const child = spawn("/bin/zsh", ["-lc", command], {
        cwd,
        env: {
          ...process.env,
          ...(envPatch ?? {})
        }
      });

      hooks?.onSpawn?.(child);

      const heartbeatTimer = setInterval(() => {
        hooks?.onHeartbeat?.();
      }, 5000);
      const timeoutTimer = timeoutMs > 0
        ? setTimeout(() => {
          timeoutTriggered = true;
          try {
            child.kill("SIGTERM");
          } catch {
            // ignore kill failure and let process events finalize the result
          }
          forceKillTimer = setTimeout(() => {
            if (settled) {
              return;
            }
            try {
              child.kill("SIGKILL");
            } catch {
              // ignore kill failure and let process events finalize the result
            }
          }, 2000);
        }, timeoutMs)
        : null;

      const finalize = (result: CommandExecutionResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearInterval(heartbeatTimer);
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
          forceKillTimer = null;
        }
        resolveResult(result);
      };

      child.stdout.on("data", (chunk: Buffer | string) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        stdout += text;
        hooks?.onChunk?.("stdout", text);
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        stderr += text;
        hooks?.onChunk?.("stderr", text);
      });

      const finalizeWithCode = (code: number | null): void => {
        const cancelledReason = hooks?.cancellationReason?.() ?? null;
        finalize({
          status: cancelledReason
            ? "cancelled"
            : (timeoutTriggered ? "timeout" : (code === 0 ? "success" : "failed")),
          exitCode: code,
          stdout,
          stderr,
          error: cancelledReason ?? (timeoutTriggered ? `command timed out after ${timeoutSec}s` : null)
        });
      };

      child.on("exit", (code) => {
        finalizeWithCode(code);
      });

      child.on("close", (code) => {
        finalizeWithCode(code);
      });

      child.on("error", (error) => {
        finalize({
          status: "failed",
          exitCode: null,
          stdout,
          stderr,
          error: error.message
        });
      });
    });
  }
}
