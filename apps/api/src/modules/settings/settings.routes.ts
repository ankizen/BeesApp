import type { FastifyInstance } from "fastify";
import { settingsController } from "./settings.controller.js";

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", settingsController.list);
  app.put("/", settingsController.upsert);
  app.delete("/:key", settingsController.remove);
}
