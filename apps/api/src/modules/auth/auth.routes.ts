import type { FastifyInstance } from "fastify";
import { authController } from "./auth.controller.js";

export async function authRoutes(app: FastifyInstance) {
  app.get("/csrf-token", async (request, reply) => {
    reply.send({ csrfToken: await reply.generateCsrf() });
  });

  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, authController.login);
  app.post("/refresh", { preHandler: app.csrfProtection }, authController.refresh);
  app.post("/logout", { preHandler: app.csrfProtection }, authController.logout);
  app.get("/me", { preHandler: app.authenticate }, authController.me);
  app.post("/change-password", { preHandler: app.authenticate }, authController.changePassword);
}
