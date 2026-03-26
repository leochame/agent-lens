import test from "node:test";
import assert from "node:assert/strict";
import { buildLoopStateSnapshot, parseOptionalLimit, parseTaskId } from "./server";
import { LoopScheduler } from "../loop-scheduler/engine";

test("parseOptionalLimit falls back for null/empty/invalid and clamps valid numbers", () => {
  assert.equal(parseOptionalLimit(null, 40, 1, 200), 40);
  assert.equal(parseOptionalLimit(undefined, 40, 1, 200), 40);
  assert.equal(parseOptionalLimit("", 40, 1, 200), 40);
  assert.equal(parseOptionalLimit("abc", 40, 1, 200), 40);
  assert.equal(parseOptionalLimit("0", 40, 1, 200), 1);
  assert.equal(parseOptionalLimit("999", 40, 1, 200), 200);
  assert.equal(parseOptionalLimit("33", 40, 1, 200), 33);
});

test("buildLoopStateSnapshot uses default limits when query values are missing", () => {
  let capturedRunsLimit = 0;
  let capturedLiveLimit = 0;
  let capturedQueueLimit = 0;
  const scheduler = {
    listTasks: () => [{ id: "t1" }, { id: "t2" }],
    listRuns: (limit: number) => {
      capturedRunsLimit = limit;
      return [{ id: "r1" }];
    },
    listLiveRuns: (limit: number) => {
      capturedLiveLimit = limit;
      return [{ id: "lr1" }];
    },
    listQueue: (limit: number) => {
      capturedQueueLimit = limit;
      return [{ taskId: "q1" }];
    },
    getSettings: () => ({ maxConcurrentRuns: 4, runningCount: 0, queuedCount: 0 })
  } as unknown as LoopScheduler;

  const item = buildLoopStateSnapshot(scheduler, {
    tasks: null,
    runs: null,
    liveRuns: null,
    queue: null
  });
  assert.equal(capturedRunsLimit, 40);
  assert.equal(capturedLiveLimit, 20);
  assert.equal(capturedQueueLimit, 30);
  assert.equal(item.tasks.length, 2);
});

test("parseTaskId handles decoding safely", () => {
  assert.equal(parseTaskId("/__loop/api/tasks/simple-id/run", "run"), "simple-id");
  assert.equal(parseTaskId("/__loop/api/tasks/id%20with%20space/toggle", "toggle"), "id with space");
  assert.equal(parseTaskId("/__loop/api/tasks/%E0%A4%A/run", "run"), null);
  assert.equal(parseTaskId("/__loop/api/tasks/not-match", "run"), null);
});
