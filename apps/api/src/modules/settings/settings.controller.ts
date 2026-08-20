import type { FastifyReply, FastifyRequest } from "fastify";
import { upsertSettingSchema } from "./settings.schema.js";
import { settingsService } from "./settings.service.js";

export const settingsController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const settings = await settingsService.list(request.user.sub);
    return reply.send({ settings });
  },

  async upsert(request: FastifyRequest, reply: FastifyReply) {
    const body = upsertSettingSchema.parse(request.body);
    await settingsService.upsert(request.user.sub, body.key, body.value);
    return reply.code(204).send();
  },

  async remove(request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) {
    await settingsService.remove(request.user.sub, request.params.key);
    return reply.code(204).send();
  },
};
