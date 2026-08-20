import type { FastifyReply, FastifyRequest } from "fastify";
import { analyticsService } from "./analytics.service.js";

export const analyticsController = {
  async dashboard(request: FastifyRequest, reply: FastifyReply) {
    const stats = await analyticsService.dashboard(request.user.sub);
    return reply.send(stats);
  },
};
