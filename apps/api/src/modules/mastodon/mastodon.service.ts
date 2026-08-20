import { env } from "../../config/env.js";
import { buildCaption } from "../../lib/caption.js";
import { socialAccountsRepo } from "../../lib/socialAccounts.js";
import { mastodonRepository } from "./mastodon.repository.js";

const REDIRECT_URI = `${env.APP_BASE_URL}/api/mastodon/callback`;

export class MastodonError extends Error {
  statusCode = 400;
  constructor(message: string, public retryable = true) {
    super(message);
  }
}

function normalizeInstanceUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export const mastodonService = {
  // Mastodon has no central app registry - each instance issues its own
  // client_id/secret, so we register the app dynamically on first connect.
  async startConnect(userId: string, instanceUrl: string) {
    const instance = normalizeInstanceUrl(instanceUrl);

    const appRes = await fetch(`${instance}/api/v1/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Content Hub",
        redirect_uris: REDIRECT_URI,
        scopes: "read write:statuses",
        website: env.APP_BASE_URL,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!appRes.ok) throw new MastodonError(`Could not register app with ${instance}`, false);
    const app = (await appRes.json()) as { client_id: string; client_secret: string };

    const state = await mastodonRepository.createOAuthState({
      userId,
      instanceUrl: instance,
      clientId: app.client_id,
      clientSecret: app.client_secret,
    });

    const params = new URLSearchParams({
      client_id: app.client_id,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "read write:statuses",
      state,
    });
    return `${instance}/oauth/authorize?${params.toString()}`;
  },

  async handleCallback(code: string, state: string) {
    const pending = await mastodonRepository.consumeOAuthState(state);
    if (!pending) throw new MastodonError("OAuth state expired or invalid", false);

    const tokenRes = await fetch(`${pending.instanceUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: pending.clientId,
        client_secret: pending.clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code,
        scope: "read write:statuses",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) throw new MastodonError("Token exchange failed", false);
    const token = (await tokenRes.json()) as { access_token: string };

    const accountRes = await fetch(`${pending.instanceUrl}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const account = (await accountRes.json()) as { id: string; username: string };

    return mastodonRepository.createAccount({
      userId: pending.userId,
      platformKey: "mastodon",
      accountName: `@${account.username}@${new URL(pending.instanceUrl).host}`,
      externalAccountId: account.id,
      instanceUrl: pending.instanceUrl,
      accessToken: token.access_token,
    });
  },

  async listAccounts(userId: string) {
    return mastodonRepository.listAccounts(userId);
  },

  async disconnect(userId: string, accountId: string) {
    const account = await mastodonRepository.findAccount(accountId, userId);
    if (!account) throw new MastodonError("Account not found", false);
    await mastodonRepository.removeAccount(accountId);
  },

  async publish(
    article: { title: string; excerpt: string; url: string },
    account: { instanceUrl: string | null; accessTokenEnc: string },
  ) {
    if (!account.instanceUrl) throw new MastodonError("Mastodon account missing instance URL", false);
    const accessToken = socialAccountsRepo.decryptAccessToken(account);
    const caption = buildCaption(article);

    const res = await fetch(`${account.instanceUrl}/api/v1/statuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ status: caption }),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json()) as { id?: string; error?: string };

    if (!res.ok || json.error) {
      const retryable = res.status >= 500 || res.status === 429;
      throw Object.assign(new MastodonError(json.error ?? `HTTP ${res.status}`, retryable), {
        statusCode: res.status,
        responseBody: json,
      });
    }

    return { externalPostId: json.id, statusCode: res.status, responseBody: json };
  },
};
