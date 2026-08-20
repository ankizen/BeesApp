import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { decrypt, encrypt } from "../../lib/crypto.js";
import { articlesService } from "../articles/articles.service.js";
import { wordpressRepository } from "./wordpress.repository.js";
import type { CreateSiteInput, UpdateSiteInput, WebhookPayload } from "./wordpress.schema.js";

export class WordpressError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

function toPublicSite(site: Awaited<ReturnType<typeof wordpressRepository.findById>>) {
  if (!site) return null;
  const { appPasswordEnc, webhookSecretEnc, ...rest } = site;
  return rest;
}

export const wordpressService = {
  async list(userId: string) {
    const sites = await wordpressRepository.listByUser(userId);
    return sites.map(toPublicSite);
  },

  async create(userId: string, input: CreateSiteInput) {
    const webhookSecret = randomBytes(32).toString("hex");
    const site = await wordpressRepository.create({
      userId,
      name: input.name,
      url: input.url.replace(/\/+$/, ""),
      username: input.username,
      appPasswordEnc: encrypt(input.appPassword),
      webhookSecretEnc: encrypt(webhookSecret),
    });
    // webhookSecret is only ever shown once, at creation time - the plugin
    // must be configured with it immediately.
    return { ...toPublicSite(site), webhookSecret };
  },

  async update(userId: string, id: string, input: UpdateSiteInput) {
    const existing = await wordpressRepository.findByIdForUser(id, userId);
    if (!existing) throw new WordpressError("Site not found", 404);

    const data: Record<string, unknown> = {
      ...(input.name ? { name: input.name } : {}),
      ...(input.url ? { url: input.url.replace(/\/+$/, "") } : {}),
      ...(input.username ? { username: input.username } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.appPassword ? { appPasswordEnc: encrypt(input.appPassword) } : {}),
    };
    const site = await wordpressRepository.update(id, data);
    return toPublicSite(site);
  },

  async delete(userId: string, id: string) {
    const existing = await wordpressRepository.findByIdForUser(id, userId);
    if (!existing) throw new WordpressError("Site not found", 404);
    await wordpressRepository.delete(id);
  },

  async testConnection(userId: string, id: string) {
    const site = await wordpressRepository.findByIdForUser(id, userId);
    if (!site) throw new WordpressError("Site not found", 404);

    const appPassword = decrypt(site.appPasswordEnc);
    const auth = Buffer.from(`${site.username}:${appPassword}`).toString("base64");

    try {
      const res = await fetch(`${site.url}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return { ok: false, statusCode: res.status, message: `WordPress responded with ${res.status}` };
      }
      const body = (await res.json()) as { name?: string };
      await wordpressRepository.markSynced(id);
      return { ok: true, statusCode: res.status, message: `Connected as ${body.name ?? site.username}` };
    } catch (err) {
      return { ok: false, statusCode: 0, message: err instanceof Error ? err.message : "Connection failed" };
    }
  },

  // Verifies the plugin's HMAC-SHA256 signature over the raw request body.
  async verifyWebhookSignature(siteId: string, rawBody: Buffer, signatureHeader: string | undefined) {
    if (!signatureHeader) return false;
    const site = await wordpressRepository.findById(siteId);
    if (!site || site.status !== "ACTIVE") return false;

    const secret = decrypt(site.webhookSecretEnc);
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const provided = signatureHeader.replace(/^sha256=/, "");

    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(provided, "hex");
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  },

  // Ingests a webhook payload: store/update the article, fan out publish jobs.
  // Must stay fast - this runs inside the webhook request handler.
  async ingestWebhook(siteId: string, payload: WebhookPayload) {
    const article = await articlesService.upsertFromWebhook(siteId, payload);
    await wordpressRepository.markSynced(siteId);
    return article;
  },
};
