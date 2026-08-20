import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

// AES-256-GCM, key from ENCRYPTION_KEY (32-byte hex). Used for OAuth tokens,
// WordPress application passwords, and webhook secrets at rest.
const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex");
const IV_LENGTH = 12; // GCM standard nonce size

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv.ciphertext.authTag, all base64url
  return [iv, ciphertext, authTag].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, ciphertextB64, authTagB64] = payload.split(".");
  if (!ivB64 || !ciphertextB64 || !authTagB64) {
    throw new Error("Malformed encrypted payload");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const ciphertext = Buffer.from(ciphertextB64, "base64url");
  const authTag = Buffer.from(authTagB64, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
