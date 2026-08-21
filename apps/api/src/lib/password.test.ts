import { test } from "node:test";
import assert from "node:assert/strict";
import { generateApiKey, hashApiKey, hashPassword, verifyPassword } from "./password.js";

test("hashPassword/verifyPassword round-trip", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
});

test("verifyPassword rejects a wrong password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("two hashes of the same password differ (random salt)", async () => {
  const a = await hashPassword("same input");
  const b = await hashPassword("same input");
  assert.notEqual(a, b);
});

test("generateApiKey prefix matches the start of the full key", () => {
  const { key, prefix } = generateApiKey();
  assert.equal(key.startsWith(prefix), true);
  assert.equal(key.startsWith("ch_"), true);
});

test("hashApiKey is deterministic", () => {
  assert.equal(hashApiKey("some-key"), hashApiKey("some-key"));
  assert.notEqual(hashApiKey("some-key"), hashApiKey("other-key"));
});
