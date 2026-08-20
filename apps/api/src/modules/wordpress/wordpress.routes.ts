import type { FastifyInstance } from "fastify";
import { wordpressController } from "./wordpress.controller.js";

// Authenticated site-management routes, mounted at /api/wordpress-sites
export async function wordpressRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", wordpressController.list);
  app.post("/", wordpressController.create);
  app.patch("/:id", wordpressController.update);
  app.delete("/:id", wordpressController.remove);
  app.post("/:id/test-connection", wordpressController.testConnection);
}
