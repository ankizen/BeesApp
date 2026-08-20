import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { connectMastodonSchema, mastodonCallbackSchema } from "./mastodon.schema.js";
import { mastodonService } from "./mastodon.service.js";

export const mastodonController = {
  async connect(request: FastifyRequest, reply: FastifyReply) {
    const body = connectMastodonSchema.parse(request.body);
    const url = await mastodonService.startConnect(request.user.sub, body.instanceUrl);
    return reply.send({ url });
  },

  async callback(request: FastifyRequest, reply: FastifyReply) {
    const query = mastodonCallbackSchema.parse(request.query);
    try {
      await mastodonService.handleCallback(query.code, query.state);
      return reply.redirect(`${env.CORS_ORIGIN}/connections?platform=mastodon&connected=1`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mastodon connection failed";
      return reply.redirect(`${env.CORS_ORIGIN}/connections?platform=mastodon&error=${encodeURIComponent(message)}`);
    }
  },

  async listAccounts(request: FastifyRequest, reply: FastifyReply) {
    const accounts = await mastodonService.listAccounts(request.user.sub);
    return reply.send({ accounts });
  },

  async disconnect(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await mastodonService.disconnect(request.user.sub, request.params.id);
    return reply.code(204).send();
  },
};
