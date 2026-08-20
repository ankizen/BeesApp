import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { facebookCallbackSchema, selectPageSchema } from "./facebook.schema.js";
import { facebookService } from "./facebook.service.js";

export const facebookController = {
  async connect(request: FastifyRequest, reply: FastifyReply) {
    const url = await facebookService.getOAuthUrl(request.user.sub);
    return reply.send({ url });
  },

  // Facebook redirects the browser here directly (not an XHR), so this
  // hands off to the frontend with a short-lived selection token in the URL.
  async callback(request: FastifyRequest, reply: FastifyReply) {
    const query = facebookCallbackSchema.parse(request.query);
    try {
      const { selectionToken } = await facebookService.handleCallback(query.code, query.state);
      return reply.redirect(`${env.CORS_ORIGIN}/connections?platform=facebook&selectionToken=${selectionToken}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Facebook connection failed";
      return reply.redirect(`${env.CORS_ORIGIN}/connections?platform=facebook&error=${encodeURIComponent(message)}`);
    }
  },

  async listPages(request: FastifyRequest<{ Querystring: { selectionToken: string } }>, reply: FastifyReply) {
    const pages = await facebookService.listPagesForSelection(request.query.selectionToken);
    return reply.send({ pages });
  },

  async selectPage(request: FastifyRequest, reply: FastifyReply) {
    const body = selectPageSchema.parse(request.body);
    const account = await facebookService.selectPage(body.selectionToken, body.pageId);
    return reply.code(201).send({ account });
  },

  async listAccounts(request: FastifyRequest, reply: FastifyReply) {
    const accounts = await facebookService.listAccounts(request.user.sub);
    return reply.send({ accounts });
  },

  async disconnect(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await facebookService.disconnect(request.user.sub, request.params.id);
    return reply.code(204).send();
  },
};
