import type { FastifyReply, FastifyRequest } from "fastify";
import { jobsQuerySchema, platformParamSchema } from "./queue.schema.js";
import { queueService } from "./queue.service.js";

export const queueController = {
  async overview(_request: FastifyRequest, reply: FastifyReply) {
    const overview = await queueService.overview();
    return reply.send(overview);
  },

  async jobs(request: FastifyRequest<{ Params: { platform: string } }>, reply: FastifyReply) {
    const { platform } = platformParamSchema.parse(request.params);
    const { state, start, end } = jobsQuerySchema.parse(request.query);
    const jobs = await queueService.jobs(platform, state, start, end);
    return reply.send({ jobs });
  },

  async retry(request: FastifyRequest<{ Params: { platform: string; jobId: string } }>, reply: FastifyReply) {
    const { platform } = platformParamSchema.parse(request.params);
    const ok = await queueService.retryJob(platform, request.params.jobId);
    if (!ok) return reply.code(404).send({ error: "Job not found" });
    return reply.code(204).send();
  },
};
