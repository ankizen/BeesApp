import type { FastifyInstance } from "fastify";
import { apiKeysController } from "./apiKeys.controller.js";

export async function apiKeysRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", apiKeysController.list);
  app.post("/", apiKeysController.create);
  app.delete("/:id", apiKeysController.revoke);
}
