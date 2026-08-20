import type { FastifyInstance } from "fastify";
import { mastodonController } from "./mastodon.controller.js";

export async function mastodonRoutes(app: FastifyInstance) {
  app.get("/callback", mastodonController.callback);

  app.register(async (scoped) => {
    scoped.addHook("preHandler", app.authenticate);
    scoped.post("/connect", mastodonController.connect);
    scoped.get("/accounts", mastodonController.listAccounts);
    scoped.delete("/accounts/:id", mastodonController.disconnect);
  });
}
