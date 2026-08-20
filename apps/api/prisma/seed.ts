import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Inlined rather than imported from src/lib/password.ts: this script runs
// standalone against the built image (no src/ dir there, only dist/), so a
// relative import across that boundary would break in production.
const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const PLATFORMS = [
  { key: "facebook", name: "Facebook Pages" },
  { key: "threads", name: "Threads" },
  { key: "mastodon", name: "Mastodon" },
];

async function main() {
  for (const platform of PLATFORMS) {
    await prisma.socialPlatform.upsert({
      where: { key: platform.key },
      update: { name: platform.name },
      create: platform,
    });
  }

  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@example.com";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme123!";

  const existing = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: await hashPassword(ownerPassword),
        name: "Owner",
        role: "OWNER",
      },
    });
    console.log(`Seeded owner user: ${ownerEmail} / ${ownerPassword} (change this password immediately)`);
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
