import type { FastifyReply, FastifyRequest } from "fastify";
import { createApiKeySchema } from "./apiKeys.schema.js";
import { apiKeysService } from "./apiKeys.service.js";

export const apiKeysController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const keys = await apiKeysService.list(request.user.sub);
    return reply.send({ keys });
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createApiKeySchema.parse(request.body);
    const key = await apiKeysService.create(request.user.sub, body);
    return reply.code(201).send({ key });
  },

  async revoke(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await apiKeysService.revoke(request.user.sub, request.params.id);
    return reply.code(204).send();
  },
};
