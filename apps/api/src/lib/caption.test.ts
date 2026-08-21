import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCaption } from "./caption.js";

test("caption format: title, excerpt, then Read More link", () => {
  const caption = buildCaption({ title: "New Post", excerpt: "A short summary.", url: "https://example.com/post" });
  assert.equal(caption, "New Post\n\nA short summary.\n\nRead More:\nhttps://example.com/post");
});

test("caption drops the excerpt paragraph when excerpt is empty", () => {
  const caption = buildCaption({ title: "New Post", excerpt: "   ", url: "https://example.com/post" });
  assert.equal(caption, "New Post\n\nRead More:\nhttps://example.com/post");
});
