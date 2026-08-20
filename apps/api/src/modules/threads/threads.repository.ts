import { randomBytes } from "node:crypto";
import { redis } from "../../lib/redis.js";
import { socialAccountsRepo } from "../../lib/socialAccounts.js";

const OAUTH_STATE_TTL_SECONDS = 600;

export const threadsRepository = {
  listAccounts: (userId: string) => socialAccountsRepo.listForUser(userId, "threads"),
  findAccount: (id: string, userId: string) => socialAccountsRepo.findByIdForUser(id, userId),
  removeAccount: (id: string) => socialAccountsRepo.remove(id),
  createAccount: socialAccountsRepo.create,
  updateTokens: socialAccountsRepo.updateTokens,

  async createOAuthState(userId: string) {
    const state = randomBytes(24).toString("base64url");
    await redis.set(`th:oauth:${state}`, userId, "EX", OAUTH_STATE_TTL_SECONDS);
    return state;
  },

  async consumeOAuthState(state: string) {
    const key = `th:oauth:${state}`;
    const userId = await redis.get(key);
    if (userId) await redis.del(key);
    return userId;
  },
};
