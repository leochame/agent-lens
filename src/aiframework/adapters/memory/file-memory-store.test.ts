import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileMemoryStore } from "./file-memory-store";

test("file memory store loads empty context for unknown task", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-memory-empty-"));
  try {
    const store = new FileMemoryStore({ baseDir: dir });
    const context = await store.loadContext("task-a");
    assert.equal(context, "");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file memory store saves records and keeps latest rounds only", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-memory-keep-rounds-"));
  try {
    const store = new FileMemoryStore({ baseDir: dir, keepRounds: 2, contextChars: 4000 });
    await store.saveRecord("task-a", {
      at: "2026-03-31T10:00:00.000Z",
      prompt: "p1",
      result: { status: "success", error: null, stdout: "s1", stderr: "" }
    });
    await store.saveRecord("task-a", {
      at: "2026-03-31T10:01:00.000Z",
      prompt: "p2",
      result: { status: "failed", error: "boom", stdout: "", stderr: "e2" }
    });
    await store.saveRecord("task-a", {
      at: "2026-03-31T10:02:00.000Z",
      prompt: "p3",
      result: { status: "success", error: null, stdout: "s3", stderr: "" }
    });

    const context = await store.loadContext("task-a");
    assert.match(context, /2026-03-31T10:01:00.000Z/);
    assert.match(context, /2026-03-31T10:02:00.000Z/);
    assert.ok(!context.includes("2026-03-31T10:00:00.000Z"));

    const files = await readdir(dir);
    const dataFile = files.find((item) => /^task-a-.*\.json$/.test(item));
    if (!dataFile) {
      throw new Error("expected task memory file to be created");
    }
    const persisted = JSON.parse(await readFile(join(dir, dataFile), "utf8")) as { records: unknown[] };
    assert.equal(persisted.records.length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file memory store isolates tasks and trims loaded context", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-memory-isolate-"));
  try {
    const store = new FileMemoryStore({ baseDir: dir, keepRounds: 3, contextChars: 420 });
    await store.saveRecord("task-a", {
      at: "2026-03-31T10:03:00.000Z",
      prompt: "p",
      result: {
        status: "success",
        error: null,
        stdout: "x".repeat(1000),
        stderr: ""
      }
    });
    await store.saveRecord("task-b", {
      at: "2026-03-31T10:04:00.000Z",
      prompt: "p",
      result: {
        status: "failed",
        error: "error-b",
        stdout: "",
        stderr: "stderr-b"
      }
    });

    const contextA = await store.loadContext("task-a");
    const contextB = await store.loadContext("task-b");
    assert.ok(contextA.length <= 420);
    assert.ok(!contextA.includes("error-b"));
    assert.match(contextB, /error-b/);
    assert.match(contextB, /stderr-b/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file memory store sanitizes task id when persisting file path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lens-memory-sanitize-"));
  try {
    const store = new FileMemoryStore({ baseDir: dir });
    await store.saveRecord("../outside/../../task-x", {
      at: "2026-03-31T10:05:00.000Z",
      prompt: "p",
      result: { status: "success", error: null, stdout: "ok", stderr: "" }
    });

    const files = await readdir(dir);
    assert.equal(files.length, 1);
    assert.match(files[0], /\.json$/);
    assert.ok(!files[0].includes("/"));
    assert.ok(!files[0].includes(".."));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
