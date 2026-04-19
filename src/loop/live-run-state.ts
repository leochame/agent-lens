import {
  LoopRunLive,
  LoopRunLiveEvent,
  LoopTask
} from "./types";
import { clamp, nowIso } from "./task-normalization";

const LIVE_EVENT_LIMIT = 120;
const LIVE_OUTPUT_TAIL_LIMIT = 5000;
const LIVE_HEARTBEAT_STALE_SEC = 30;

export class LiveRunState {
  private readonly liveRuns: Map<string, LoopRunLive> = new Map();

  list(limit = 20): LoopRunLive[] {
    const n = clamp(limit, 1, 100);
    const now = Date.now();
    return Array.from(this.liveRuns.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, n)
      .map((item) => {
        const heartbeatMs = Date.parse(item.heartbeatAt);
        const silenceSec = Number.isFinite(heartbeatMs)
          ? Math.max(0, Math.floor((now - heartbeatMs) / 1000))
          : LIVE_HEARTBEAT_STALE_SEC + 1;
        return {
          ...item,
          silenceSec,
          heartbeatStale: silenceSec >= LIVE_HEARTBEAT_STALE_SEC,
          events: item.events.slice(-40)
        };
      });
  }

  init(runId: string, task: LoopTask, trigger: "timer" | "manual", startedAt: string): void {
    this.liveRuns.set(runId, {
      id: runId,
      taskId: task.id,
      taskName: task.name,
      runner: task.runner,
      trigger,
      startedAt,
      heartbeatAt: startedAt,
      silenceSec: 0,
      heartbeatStale: false,
      phase: "preparing",
      round: 1,
      stepIndex: 0,
      totalSteps: 0,
      stepName: null,
      events: [],
      stdoutTail: "",
      stderrTail: ""
    });
  }

  setPhase(runId: string, phase: LoopRunLive["phase"]): void {
    const current = this.liveRuns.get(runId);
    if (!current) {
      return;
    }
    current.phase = phase;
    current.heartbeatAt = nowIso();
  }

  setStep(runId: string, round: number, stepIndex: number, totalSteps: number, stepName: string | null): void {
    const current = this.liveRuns.get(runId);
    if (!current) {
      return;
    }
    current.round = round;
    current.stepIndex = stepIndex;
    current.totalSteps = totalSteps;
    current.stepName = stepName;
    current.heartbeatAt = nowIso();
  }

  pushEvent(runId: string, level: LoopRunLiveEvent["level"], message: string): void {
    const current = this.liveRuns.get(runId);
    if (!current) {
      return;
    }
    current.events.push({
      at: nowIso(),
      level,
      message
    });
    if (current.events.length > LIVE_EVENT_LIMIT) {
      current.events.splice(0, current.events.length - LIVE_EVENT_LIMIT);
    }
    current.heartbeatAt = nowIso();
  }

  appendOutput(runId: string, stream: "stdout" | "stderr", chunk: string): void {
    const current = this.liveRuns.get(runId);
    if (!current || !chunk) {
      return;
    }
    if (stream === "stdout") {
      current.stdoutTail = `${current.stdoutTail}${chunk}`.slice(-LIVE_OUTPUT_TAIL_LIMIT);
    } else {
      current.stderrTail = `${current.stderrTail}${chunk}`.slice(-LIVE_OUTPUT_TAIL_LIMIT);
    }
    current.heartbeatAt = nowIso();
  }

  touch(runId: string): void {
    const current = this.liveRuns.get(runId);
    if (!current) {
      return;
    }
    current.heartbeatAt = nowIso();
  }

  clear(runId: string): void {
    this.liveRuns.delete(runId);
  }
}
