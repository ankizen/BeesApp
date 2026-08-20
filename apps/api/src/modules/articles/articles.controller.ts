import type { FastifyReply, FastifyRequest } from "fastify";
import { bulkPublishSchema, listArticlesQuerySchema } from "./articles.schema.js";
import { articlesService } from "./articles.service.js";

export const articlesController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listArticlesQuerySchema.parse(request.query);
    const result = await articlesService.list(request.user.sub, query);
    return reply.send(result);
  },

  async detail(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const result = await articlesService.getDetail(request.user.sub, request.params.id);
    return reply.send(result);
  },

  async republish(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const jobs = await articlesService.republish(request.user.sub, request.params.id);
    return reply.send({ jobs });
  },

  async bulkPublish(request: FastifyRequest, reply: FastifyReply) {
    const body = bulkPublishSchema.parse(request.body);
    const result = await articlesService.bulkPublish(request.user.sub, body);
    return reply.send(result);
  },
};
