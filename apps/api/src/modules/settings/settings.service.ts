import type { Prisma } from "@prisma/client";
import { settingsRepository } from "./settings.repository.js";

export const settingsService = {
  async list(userId: string) {
    const rows = await settingsRepository.listForUser(userId);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  upsert(userId: string, key: string, value: unknown) {
    return settingsRepository.upsert(userId, key, value as Prisma.InputJsonValue);
  },

  remove(userId: string, key: string) {
    return settingsRepository.remove(userId, key);
  },
};
