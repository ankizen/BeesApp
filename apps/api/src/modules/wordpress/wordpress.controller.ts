import type { FastifyReply, FastifyRequest } from "fastify";
import { childLogger } from "../../lib/logger.js";
import { createSiteSchema, updateSiteSchema, webhookPayloadSchema } from "./wordpress.schema.js";
import { wordpressService } from "./wordpress.service.js";

const log = childLogger({ module: "wordpress-webhook" });

export const wordpressController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const sites = await wordpressService.list(request.user.sub);
    return reply.send({ sites });
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createSiteSchema.parse(request.body);
    const site = await wordpressService.create(request.user.sub, body);
    return reply.code(201).send({ site });
  },

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const body = updateSiteSchema.parse(request.body);
    const site = await wordpressService.update(request.user.sub, request.params.id, body);
    return reply.send({ site });
  },

  async remove(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await wordpressService.delete(request.user.sub, request.params.id);
    return reply.code(204).send();
  },

  async testConnection(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const result = await wordpressService.testConnection(request.user.sub, request.params.id);
    return reply.send(result);
  },

  // Public endpoint hit by the WordPress plugin. Must respond fast: verify
  // signature, validate shape, store + enqueue, return 202. No publishing
  // happens inline.
  async webhook(request: FastifyRequest<{ Params: { siteId: string } }>, reply: FastifyReply) {
    const signature = request.headers["x-content-hub-signature"] as string | undefined;
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));

    const valid = await wordpressService.verifyWebhookSignature(request.params.siteId, rawBody, signature);
    if (!valid) {
      log.warn({ siteId: request.params.siteId }, "rejected webhook: invalid signature");
      return reply.code(401).send({ error: "Invalid signature" });
    }

    const parsed = webhookPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const article = await wordpressService.ingestWebhook(request.params.siteId, parsed.data);
    return reply.code(202).send({ articleId: article.id, status: article.status });
  },

  // Signature-only connectivity check for the plugin's "Test Connection"
  // button - verifies the shared secret without creating an Article or
  // firing any publish jobs.
  async webhookPing(request: FastifyRequest<{ Params: { siteId: string } }>, reply: FastifyReply) {
    const signature = request.headers["x-content-hub-signature"] as string | undefined;
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));

    const valid = await wordpressService.verifyWebhookSignature(request.params.siteId, rawBody, signature);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid signature" });
    }
    return reply.send({ ok: true });
  },
};
