import type { FastifyInstance } from "fastify";
import { queueController } from "./queue.controller.js";

export async function queueRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/overview", queueController.overview);
  app.get("/:platform/jobs", queueController.jobs);
  app.post("/:platform/jobs/:jobId/retry", queueController.retry);
}
