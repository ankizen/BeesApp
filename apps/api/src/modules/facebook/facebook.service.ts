import { env } from "../../config/env.js";
import { buildCaption } from "../../lib/caption.js";
import { childLogger } from "../../lib/logger.js";
import { socialAccountsRepo } from "../../lib/socialAccounts.js";
import { facebookRepository, type FacebookPageOption } from "./facebook.repository.js";

const GRAPH_API = "https://graph.facebook.com/v21.0";
const log = childLogger({ module: "facebook" });

export class FacebookError extends Error {
  statusCode = 400;
  constructor(message: string, public retryable = true) {
    super(message);
  }
}

function requireAppCredentials() {
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET || !env.FACEBOOK_REDIRECT_URI) {
    throw new FacebookError("Facebook app credentials are not configured", false);
  }
  return { appId: env.FACEBOOK_APP_ID, appSecret: env.FACEBOOK_APP_SECRET, redirectUri: env.FACEBOOK_REDIRECT_URI };
}

export const facebookService = {
  async getOAuthUrl(userId: string) {
    const { appId, redirectUri } = requireAppCredentials();
    const state = await facebookRepository.createOAuthState(userId);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: "pages_manage_posts,pages_read_engagement,pages_show_list,business_management",
      response_type: "code",
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  },

  // Exchanges the OAuth code for pages the user can post to, and caches
  // them for a short window so the frontend can present a "select a page" step.
  async handleCallback(code: string, state: string) {
    const userId = await facebookRepository.consumeOAuthState(state);
    if (!userId) throw new FacebookError("OAuth state expired or invalid", false);

    const { appId, appSecret, redirectUri } = requireAppCredentials();

    const shortTokenRes = await fetch(
      `${GRAPH_API}/oauth/access_token?` +
        new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code }),
    );
    const shortToken = (await shortTokenRes.json()) as { access_token?: string; error?: { message: string } };
    if (!shortToken.access_token) throw new FacebookError(shortToken.error?.message ?? "Token exchange failed", false);

    const longTokenRes = await fetch(
      `${GRAPH_API}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortToken.access_token,
        }),
    );
    const longToken = (await longTokenRes.json()) as { access_token?: string };
    const userToken = longToken.access_token ?? shortToken.access_token;

    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,name,access_token,category&access_token=${userToken}`,
    );
    const pagesBody = (await pagesRes.json()) as { data?: FacebookPageOption[]; error?: { message: string } };
    if (!pagesBody.data) throw new FacebookError(pagesBody.error?.message ?? "Could not list Pages", false);

    const selectionToken = await facebookRepository.cachePageOptions(userId, pagesBody.data);
    return { selectionToken, pages: pagesBody.data.map(({ id, name, category }) => ({ id, name, category })) };
  },

  async listPagesForSelection(selectionToken: string) {
    const cached = await facebookRepository.getPageOptions(selectionToken);
    if (!cached) throw new FacebookError("Selection expired, restart Facebook connection", false);
    return cached.pages.map(({ id, name, category }) => ({ id, name, category }));
  },

  async selectPage(selectionToken: string, pageId: string) {
    const cached = await facebookRepository.getPageOptions(selectionToken);
    if (!cached) throw new FacebookError("Selection expired, restart Facebook connection", false);
    const page = cached.pages.find((p) => p.id === pageId);
    if (!page) throw new FacebookError("Page not found in selection", false);

    // Page access tokens derived from a long-lived user token don't expire.
    return facebookRepository.createAccount({
      userId: cached.userId,
      platformKey: "facebook",
      accountName: page.name,
      externalAccountId: page.id,
      accessToken: page.accessToken,
      metadata: { category: page.category },
    });
  },

  async listAccounts(userId: string) {
    return facebookRepository.listAccounts(userId);
  },

  async disconnect(userId: string, accountId: string) {
    const account = await facebookRepository.findAccount(accountId, userId);
    if (!account) throw new FacebookError("Account not found", false);
    await facebookRepository.removeAccount(accountId);
  },

  // Called by the publish worker. Photo post if there's a featured image
  // (caption embeds the link, per the fixed caption format), else a feed
  // post with an explicit link attachment.
  async publish(article: { title: string; excerpt: string; url: string; featuredImageUrl: string | null }, account: {
    externalAccountId: string;
    accessTokenEnc: string;
  }) {
    const pageToken = socialAccountsRepo.decryptAccessToken(account);
    const caption = buildCaption(article);

    const endpoint = article.featuredImageUrl
      ? `${GRAPH_API}/${account.externalAccountId}/photos`
      : `${GRAPH_API}/${account.externalAccountId}/feed`;

    const body = article.featuredImageUrl
      ? { url: article.featuredImageUrl, caption, access_token: pageToken }
      : { message: caption, link: article.url, access_token: pageToken };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json()) as { id?: string; error?: { message: string; code: number } };

    if (!res.ok || json.error) {
      log.error({ status: res.status, error: json.error }, "facebook publish failed");
      // Facebook rate-limit / transient errors are in the 4xx/500 range with
      // specific error codes; treat 5xx and rate-limit codes as retryable.
      const retryable = res.status >= 500 || json.error?.code === 4 || json.error?.code === 17;
      throw Object.assign(new FacebookError(json.error?.message ?? `HTTP ${res.status}`, retryable), {
        statusCode: res.status,
        responseBody: json,
      });
    }

    return { externalPostId: json.id, statusCode: res.status, responseBody: json };
  },
};
