import { test } from "node:test";
import assert from "node:assert/strict";
import { decideArticleStatus } from "./articleStatus.js";

test("PUBLISHING while any job is still in flight", () => {
  assert.equal(decideArticleStatus([{ status: "SUCCESS" }, { status: "QUEUED" }]), "PUBLISHING");
  assert.equal(decideArticleStatus([{ status: "PROCESSING" }]), "PUBLISHING");
});

test("PUBLISHED when every job succeeded", () => {
  assert.equal(decideArticleStatus([{ status: "SUCCESS" }, { status: "SUCCESS" }]), "PUBLISHED");
});

test("FAILED when every job failed", () => {
  assert.equal(decideArticleStatus([{ status: "FAILED" }, { status: "FAILED" }]), "FAILED");
});

test("PARTIAL when terminal but mixed outcomes", () => {
  assert.equal(decideArticleStatus([{ status: "SUCCESS" }, { status: "FAILED" }]), "PARTIAL");
});
