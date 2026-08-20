import type { FastifyInstance } from "fastify";
import { articlesController } from "./articles.controller.js";

export async function articlesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", articlesController.list);
  app.get("/:id", articlesController.detail);
  app.post("/:id/republish", articlesController.republish);
  app.post("/bulk-publish", articlesController.bulkPublish);
}
