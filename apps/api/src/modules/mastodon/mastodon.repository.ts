import { randomBytes } from "node:crypto";
import { redis } from "../../lib/redis.js";
import { socialAccountsRepo } from "../../lib/socialAccounts.js";

const OAUTH_STATE_TTL_SECONDS = 600;

interface MastodonOAuthState {
  userId: string;
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
}

export const mastodonRepository = {
  listAccounts: (userId: string) => socialAccountsRepo.listForUser(userId, "mastodon"),
  findAccount: (id: string, userId: string) => socialAccountsRepo.findByIdForUser(id, userId),
  removeAccount: (id: string) => socialAccountsRepo.remove(id),
  createAccount: socialAccountsRepo.create,

  async createOAuthState(state: MastodonOAuthState) {
    const token = randomBytes(24).toString("base64url");
    await redis.set(`mstdn:oauth:${token}`, JSON.stringify(state), "EX", OAUTH_STATE_TTL_SECONDS);
    return token;
  },

  async consumeOAuthState(token: string) {
    const key = `mstdn:oauth:${token}`;
    const raw = await redis.get(key);
    if (!raw) return null;
    await redis.del(key);
    return JSON.parse(raw) as MastodonOAuthState;
  },
};
