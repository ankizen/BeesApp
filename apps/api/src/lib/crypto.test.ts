import { test } from "node:test";
import assert from "node:assert/strict";
import { decrypt, encrypt } from "./crypto.js";

test("encrypt/decrypt round-trip", () => {
  const plaintext = "wp_app_password_or_oauth_token";
  const ciphertext = encrypt(plaintext);
  assert.equal(decrypt(ciphertext), plaintext);
});

test("encrypting the same value twice yields different ciphertext (random IV)", () => {
  assert.notEqual(encrypt("same secret"), encrypt("same secret"));
});

test("decrypt rejects a tampered payload", () => {
  const ciphertext = encrypt("token");
  const [iv, body, tag] = ciphertext.split(".");
  const tampered = [iv, body.slice(0, -2) + "AA", tag].join(".");
  assert.throws(() => decrypt(tampered));
});

test("decrypt rejects a malformed payload", () => {
  assert.throws(() => decrypt("not-a-valid-payload"));
});
