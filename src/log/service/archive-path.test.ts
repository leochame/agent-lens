import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveRootFromLogFile,
  archiveRecordFilePath,
  legacyArchiveByRequestFilePath,
  legacyArchiveRecordFilePath
} from "./archive-path";

test("archiveRootFromLogFile derives stable archive directory", () => {
  const root = archiveRootFromLogFile("/tmp/logs/requests.log");
  assert.equal(root, "/tmp/logs/requests.archive");
});

test("archiveRecordFilePath sanitizes request id and format", () => {
  const p = archiveRecordFilePath(
    "/tmp/logs/requests.log",
    null,
    "req/1?bad",
    "request",
    "openai"
  );
  assert.equal(
    p,
    "/tmp/logs/requests.archive/by-format/openai/by-request/req_1_bad/request.json"
  );
});

test("legacy archive path helpers keep compatibility layout", () => {
  const p1 = legacyArchiveByRequestFilePath("/tmp/logs/requests.log", "abc-123", "response");
  assert.equal(p1, "/tmp/logs/requests.archive/by-request/abc-123/response.json");

  const p2 = legacyArchiveRecordFilePath("/tmp/logs/requests.log", null, "req-7", "request");
  assert.equal(p2, "/tmp/logs/requests.archive/no-session/req-7.request.json");
});
