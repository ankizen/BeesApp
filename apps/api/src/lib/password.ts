import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

// node:crypto scrypt instead of bcrypt/argon2 - one fewer native dependency,
// and scrypt is a fine password KDF. Format: scrypt$<saltHex>$<hashHex>
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, salt, expected.length);
  return timingSafeEqual(derived, expected);
}

export function generateApiKey(): { key: string; prefix: string } {
  const key = `ch_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 10) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
