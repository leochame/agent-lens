import test from "node:test";
import assert from "node:assert/strict";
import { ZshCommandRunner } from "./zsh-command-runner";

test("zsh command runner captures stdout/stderr", async () => {
  const runner = new ZshCommandRunner();
  const result = await runner.run("echo out; echo err 1>&2", process.cwd(), 0);
  assert.equal(result.status, "success");
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /out/);
  assert.match(result.stderr, /err/);
});

test("zsh command runner marks cancelled when cancellation callback returns reason", async () => {
  const runner = new ZshCommandRunner();
  const result = await runner.run("echo done", process.cwd(), 0, undefined, {
    cancellationReason: () => "manual cancel"
  });
  assert.equal(result.status, "cancelled");
  assert.equal(result.error, "manual cancel");
});

test("zsh command runner returns timeout when command exceeds timeoutSec", async () => {
  const runner = new ZshCommandRunner();
  const result = await runner.run("sleep 1.2; echo done", process.cwd(), 0.1);
  assert.equal(result.status, "timeout");
  assert.match(String(result.error), /timed out/);
});

test("zsh command runner force-kills process when timeout command ignores SIGTERM", async () => {
  const runner = new ZshCommandRunner();
  const startedAt = Date.now();
  const result = await runner.run("trap '' TERM; sleep 30", process.cwd(), 0.1);
  const elapsedMs = Date.now() - startedAt;

  assert.equal(result.status, "timeout");
  assert.match(String(result.error), /timed out/);
  assert.equal(elapsedMs < 5000, true);
});
