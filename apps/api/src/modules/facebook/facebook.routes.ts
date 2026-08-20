import type { FastifyInstance } from "fastify";
import { facebookController } from "./facebook.controller.js";

export async function facebookRoutes(app: FastifyInstance) {
  // Callback is hit by Facebook's redirect, not the SPA - no JWT available.
  app.get("/callback", facebookController.callback);

  app.register(async (scoped) => {
    scoped.addHook("preHandler", app.authenticate);
    scoped.get("/connect", facebookController.connect);
    scoped.get("/pages", facebookController.listPages);
    scoped.post("/pages/select", facebookController.selectPage);
    scoped.get("/accounts", facebookController.listAccounts);
    scoped.delete("/accounts/:id", facebookController.disconnect);
  });
}
