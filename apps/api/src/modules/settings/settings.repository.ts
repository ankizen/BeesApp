import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "@prisma/client";

export const settingsRepository = {
  listForUser(userId: string) {
    return prisma.setting.findMany({ where: { userId } });
  },

  upsert(userId: string, key: string, value: Prisma.InputJsonValue) {
    return prisma.setting.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value },
      update: { value },
    });
  },

  remove(userId: string, key: string) {
    return prisma.setting.deleteMany({ where: { userId, key } });
  },
};
