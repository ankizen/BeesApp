import { env } from "../../config/env.js";
import { buildCaption } from "../../lib/caption.js";
import { childLogger } from "../../lib/logger.js";
import { socialAccountsRepo } from "../../lib/socialAccounts.js";
import { threadsRepository } from "./threads.repository.js";

const GRAPH_API = "https://graph.threads.net/v1.0";
const log = childLogger({ module: "threads" });

export class ThreadsError extends Error {
  statusCode = 400;
  constructor(message: string, public retryable = true) {
    super(message);
  }
}

function requireAppCredentials() {
  if (!env.THREADS_APP_ID || !env.THREADS_APP_SECRET || !env.THREADS_REDIRECT_URI) {
    throw new ThreadsError("Threads app credentials are not configured", false);
  }
  return { appId: env.THREADS_APP_ID, appSecret: env.THREADS_APP_SECRET, redirectUri: env.THREADS_REDIRECT_URI };
}

export const threadsService = {
  async getOAuthUrl(userId: string) {
    const { appId, redirectUri } = requireAppCredentials();
    const state = await threadsRepository.createOAuthState(userId);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: "threads_basic,threads_content_publish",
      response_type: "code",
    });
    return `https://threads.net/oauth/authorize?${params.toString()}`;
  },

  async handleCallback(code: string, state: string) {
    const userId = await threadsRepository.consumeOAuthState(state);
    if (!userId) throw new ThreadsError("OAuth state expired or invalid", false);

    const { appId, appSecret, redirectUri } = requireAppCredentials();

    const shortRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const shortToken = (await shortRes.json()) as { access_token?: string; user_id?: string; error_message?: string };
    if (!shortToken.access_token) throw new ThreadsError(shortToken.error_message ?? "Token exchange failed", false);

    // Exchange for a long-lived token (60 days), refreshable before expiry.
    const longRes = await fetch(
      `https://graph.threads.net/access_token?` +
        new URLSearchParams({
          grant_type: "th_exchange_token",
          client_secret: appSecret,
          access_token: shortToken.access_token,
        }),
    );
    const longToken = (await longRes.json()) as { access_token?: string; expires_in?: number };

    const accessToken = longToken.access_token ?? shortToken.access_token;
    const expiresIn = longToken.expires_in ?? 60 * 24 * 60 * 60;

    const profileRes = await fetch(`${GRAPH_API}/me?fields=id,username&access_token=${accessToken}`);
    const profile = (await profileRes.json()) as { id?: string; username?: string };

    return threadsRepository.createAccount({
      userId,
      platformKey: "threads",
      accountName: profile.username ?? "Threads account",
      externalAccountId: profile.id ?? shortToken.user_id ?? "",
      accessToken,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    });
  },

  async listAccounts(userId: string) {
    return threadsRepository.listAccounts(userId);
  },

  async disconnect(userId: string, accountId: string) {
    const account = await threadsRepository.findAccount(accountId, userId);
    if (!account) throw new ThreadsError("Account not found", false);
    await threadsRepository.removeAccount(accountId);
  },

  // Refreshes a long-lived token before it expires (Threads tokens last ~60
  // days). Call this from the worker before publishing if close to expiry,
  // or wire to a periodic job once volume justifies it.
  async refreshIfNeeded(account: { id: string; accessTokenEnc: string; tokenExpiresAt: Date | null }) {
    const daysLeft = account.tokenExpiresAt
      ? (account.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      : Infinity;
    if (daysLeft > 7) return socialAccountsRepo.decryptAccessToken(account);

    const currentToken = socialAccountsRepo.decryptAccessToken(account);
    const res = await fetch(
      `https://graph.threads.net/refresh_access_token?` +
        new URLSearchParams({ grant_type: "th_refresh_token", access_token: currentToken }),
    );
    const refreshed = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!refreshed.access_token) {
      log.warn({ accountId: account.id }, "threads token refresh failed, using existing token");
      return currentToken;
    }

    await threadsRepository.updateTokens(account.id, {
      accessToken: refreshed.access_token,
      tokenExpiresAt: new Date(Date.now() + (refreshed.expires_in ?? 5_184_000) * 1000),
    });
    return refreshed.access_token;
  },

  // Two-step publish: create a media container, then publish it.
  async publish(
    article: { title: string; excerpt: string; url: string },
    account: { id: string; externalAccountId: string; accessTokenEnc: string; tokenExpiresAt: Date | null },
  ) {
    const accessToken = await threadsService.refreshIfNeeded(account);
    const caption = buildCaption(article);

    const createRes = await fetch(`${GRAPH_API}/${account.externalAccountId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ media_type: "TEXT", text: caption, access_token: accessToken }),
      signal: AbortSignal.timeout(20_000),
    });
    const created = (await createRes.json()) as { id?: string; error?: { message: string; code: number } };
    if (!createRes.ok || created.error || !created.id) {
      throw asThreadsFailure(createRes.status, created);
    }

    const publishRes = await fetch(`${GRAPH_API}/${account.externalAccountId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: created.id, access_token: accessToken }),
      signal: AbortSignal.timeout(20_000),
    });
    const published = (await publishRes.json()) as { id?: string; error?: { message: string; code: number } };
    if (!publishRes.ok || published.error) {
      throw asThreadsFailure(publishRes.status, published);
    }

    return { externalPostId: published.id, statusCode: publishRes.status, responseBody: published };
  },
};

function asThreadsFailure(status: number, body: { error?: { message: string; code: number } }) {
  const retryable = status >= 500 || status === 429;
  return Object.assign(new ThreadsError(body.error?.message ?? `HTTP ${status}`, retryable), {
    statusCode: status,
    responseBody: body,
  });
}
