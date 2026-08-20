import type { FastifyInstance } from "fastify";
import { threadsController } from "./threads.controller.js";

export async function threadsRoutes(app: FastifyInstance) {
  app.get("/callback", threadsController.callback);

  app.register(async (scoped) => {
    scoped.addHook("preHandler", app.authenticate);
    scoped.get("/connect", threadsController.connect);
    scoped.get("/accounts", threadsController.listAccounts);
    scoped.delete("/accounts/:id", threadsController.disconnect);
  });
}
