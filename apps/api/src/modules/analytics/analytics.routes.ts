import type { FastifyInstance } from "fastify";
import { analyticsController } from "./analytics.controller.js";

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.get("/dashboard", analyticsController.dashboard);
}
