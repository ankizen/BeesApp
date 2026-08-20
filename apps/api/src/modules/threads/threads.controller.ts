import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { threadsCallbackSchema } from "./threads.schema.js";
import { threadsService } from "./threads.service.js";

export const threadsController = {
  async connect(request: FastifyRequest, reply: FastifyReply) {
    const url = await threadsService.getOAuthUrl(request.user.sub);
    return reply.send({ url });
  },

  async callback(request: FastifyRequest, reply: FastifyReply) {
    const query = threadsCallbackSchema.parse(request.query);
    try {
      await threadsService.handleCallback(query.code, query.state);
      return reply.redirect(`${env.CORS_ORIGIN}/connections?platform=threads&connected=1`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Threads connection failed";
      return reply.redirect(`${env.CORS_ORIGIN}/connections?platform=threads&error=${encodeURIComponent(message)}`);
    }
  },

  async listAccounts(request: FastifyRequest, reply: FastifyReply) {
    const accounts = await threadsService.listAccounts(request.user.sub);
    return reply.send({ accounts });
  },

  async disconnect(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await threadsService.disconnect(request.user.sub, request.params.id);
    return reply.code(204).send();
  },
};
