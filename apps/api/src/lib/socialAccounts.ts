import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { decrypt, encrypt } from "./crypto.js";
import type { PlatformKey } from "../modules/queue/queue.definitions.js";

// Shared CRUD over SocialAccount, reused by the facebook/threads/mastodon
// modules so token storage/encryption logic lives in exactly one place.
export const socialAccountsRepo = {
  async listForUser(userId: string, platformKey?: PlatformKey) {
    const accounts = await prisma.socialAccount.findMany({
      where: { userId, ...(platformKey ? { platform: { key: platformKey } } : {}) },
      include: { platform: true },
      orderBy: { createdAt: "desc" },
    });
    return accounts.map(withoutSecrets);
  },

  findById(id: string) {
    return prisma.socialAccount.findUnique({ where: { id }, include: { platform: true } });
  },

  findByIdForUser(id: string, userId: string) {
    return prisma.socialAccount.findFirst({ where: { id, userId }, include: { platform: true } });
  },

  async create(input: {
    userId: string;
    platformKey: PlatformKey;
    accountName: string;
    externalAccountId: string;
    instanceUrl?: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    metadata?: Record<string, unknown>;
  }) {
    const platform = await prisma.socialPlatform.findUniqueOrThrow({ where: { key: input.platformKey } });
    const account = await prisma.socialAccount.create({
      data: {
        userId: input.userId,
        platformId: platform.id,
        accountName: input.accountName,
        externalAccountId: input.externalAccountId,
        instanceUrl: input.instanceUrl,
        accessTokenEnc: encrypt(input.accessToken),
        refreshTokenEnc: input.refreshToken ? encrypt(input.refreshToken) : null,
        tokenExpiresAt: input.tokenExpiresAt,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
      include: { platform: true },
    });
    return withoutSecrets(account);
  },

  updateTokens(id: string, tokens: { accessToken: string; refreshToken?: string; tokenExpiresAt?: Date }) {
    return prisma.socialAccount.update({
      where: { id },
      data: {
        accessTokenEnc: encrypt(tokens.accessToken),
        ...(tokens.refreshToken ? { refreshTokenEnc: encrypt(tokens.refreshToken) } : {}),
        ...(tokens.tokenExpiresAt ? { tokenExpiresAt: tokens.tokenExpiresAt } : {}),
        status: "ACTIVE",
      },
    });
  },

  setAutoPublish(id: string, isAutoPublish: boolean) {
    return prisma.socialAccount.update({ where: { id }, data: { isAutoPublish } });
  },

  setStatus(id: string, status: "ACTIVE" | "EXPIRED" | "REVOKED") {
    return prisma.socialAccount.update({ where: { id }, data: { status } });
  },

  remove(id: string) {
    return prisma.socialAccount.delete({ where: { id } });
  },

  decryptAccessToken(account: { accessTokenEnc: string }) {
    return decrypt(account.accessTokenEnc);
  },

  decryptRefreshToken(account: { refreshTokenEnc: string | null }) {
    return account.refreshTokenEnc ? decrypt(account.refreshTokenEnc) : null;
  },
};

function withoutSecrets<T extends { accessTokenEnc: string; refreshTokenEnc: string | null }>(account: T) {
  const { accessTokenEnc, refreshTokenEnc, ...rest } = account;
  return rest;
}
