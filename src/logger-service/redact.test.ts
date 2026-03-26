import test from "node:test";
import assert from "node:assert/strict";
import { redactHeaders, redactJsonBody } from "./redact";

test("redactHeaders masks default sensitive keys and keeps normal ones", () => {
  const headers = redactHeaders({
    authorization: "Bearer x",
    "x-api-key": "abc",
    cookie: "c=1",
    "content-type": "application/json"
  });
  assert.equal(headers.authorization, "[REDACTED]");
  assert.equal(headers["x-api-key"], "[REDACTED]");
  assert.equal(headers.cookie, "[REDACTED]");
  assert.equal(headers["content-type"], "application/json");
});

test("redactHeaders supports custom key patterns", () => {
  const headers = redactHeaders({ "x-secret": "v1", accept: "application/json" }, ["x-secret"]);
  assert.equal(headers["x-secret"], "[REDACTED]");
  assert.equal(headers.accept, "application/json");
});

test("redactJsonBody recursively masks sensitive keys", () => {
  const input = {
    token: "t1",
    nested: {
      password: "p1",
      safe: 1
    },
    list: [{ api_key: "k1" }, { keep: "yes" }]
  };
  const redacted = redactJsonBody(input) as {
    token: string;
    nested: { password: string; safe: number };
    list: Array<{ api_key?: string; keep?: string }>;
  };
  assert.equal(redacted.token, "[REDACTED]");
  assert.equal(redacted.nested.password, "[REDACTED]");
  assert.equal(redacted.nested.safe, 1);
  assert.equal(redacted.list[0].api_key, "[REDACTED]");
  assert.equal(redacted.list[1].keep, "yes");
});
