import { randomBytes } from "node:crypto";
import { redis } from "../../lib/redis.js";
import { socialAccountsRepo } from "../../lib/socialAccounts.js";

const OAUTH_STATE_TTL_SECONDS = 600;
const PAGE_SELECTION_TTL_SECONDS = 600;

export interface FacebookPageOption {
  id: string;
  name: string;
  accessToken: string;
  category?: string;
}

export const facebookRepository = {
  listAccounts: (userId: string) => socialAccountsRepo.listForUser(userId, "facebook"),
  findAccount: (id: string, userId: string) => socialAccountsRepo.findByIdForUser(id, userId),
  removeAccount: (id: string) => socialAccountsRepo.remove(id),
  createAccount: socialAccountsRepo.create,

  async createOAuthState(userId: string) {
    const state = randomBytes(24).toString("base64url");
    await redis.set(`fb:oauth:${state}`, userId, "EX", OAUTH_STATE_TTL_SECONDS);
    return state;
  },

  async consumeOAuthState(state: string) {
    const key = `fb:oauth:${state}`;
    const userId = await redis.get(key);
    if (userId) await redis.del(key);
    return userId;
  },

  async cachePageOptions(userId: string, pages: FacebookPageOption[]) {
    const selectionToken = randomBytes(24).toString("base64url");
    await redis.set(
      `fb:pages:${selectionToken}`,
      JSON.stringify({ userId, pages }),
      "EX",
      PAGE_SELECTION_TTL_SECONDS,
    );
    return selectionToken;
  },

  async getPageOptions(selectionToken: string) {
    const raw = await redis.get(`fb:pages:${selectionToken}`);
    if (!raw) return null;
    return JSON.parse(raw) as { userId: string; pages: FacebookPageOption[] };
  },
};
