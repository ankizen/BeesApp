import { prisma } from "../../lib/prisma.js";
import type { UpdateSiteInput } from "./wordpress.schema.js";

export const wordpressRepository = {
  listByUser(userId: string) {
    return prisma.wordpressSite.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  },

  findById(id: string) {
    return prisma.wordpressSite.findUnique({ where: { id } });
  },

  findByIdForUser(id: string, userId: string) {
    return prisma.wordpressSite.findFirst({ where: { id, userId } });
  },

  create(data: {
    userId: string;
    name: string;
    url: string;
    username: string;
    appPasswordEnc: string;
    webhookSecretEnc: string;
  }) {
    return prisma.wordpressSite.create({ data });
  },

  update(id: string, data: Partial<UpdateSiteInput> & { appPasswordEnc?: string; webhookSecretEnc?: string }) {
    const { status, ...rest } = data;
    return prisma.wordpressSite.update({
      where: { id },
      data: { ...rest, ...(status ? { status } : {}) },
    });
  },

  delete(id: string) {
    return prisma.wordpressSite.delete({ where: { id } });
  },

  markSynced(id: string) {
    return prisma.wordpressSite.update({ where: { id }, data: { lastSyncAt: new Date() } });
  },
};
