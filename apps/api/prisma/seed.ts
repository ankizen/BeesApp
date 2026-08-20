import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

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
