import { prisma } from "../../lib/prisma.js";

export const apiKeysRepository = {
  listForUser(userId: string) {
    return prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, keyPrefix: true, scopes: true, lastUsedAt: true, createdAt: true, wordpressSiteId: true },
    });
  },

  create(data: { userId: string; name: string; keyPrefix: string; keyHash: string; scopes: string[]; wordpressSiteId?: string }) {
    return prisma.apiKey.create({ data });
  },

  findByHash(keyHash: string) {
    return prisma.apiKey.findFirst({ where: { keyHash, revokedAt: null } });
  },

  touchLastUsed(id: string) {
    return prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
  },

  revoke(id: string, userId: string) {
    return prisma.apiKey.updateMany({ where: { id, userId }, data: { revokedAt: new Date() } });
  },
};
