import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export default fp(async function jwtPlugin(app: FastifyInstance) {
  await app.register(jwt, { secret: env.JWT_ACCESS_SECRET });

  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.decorate("requireRole", (roles: string[]) => async (request, reply) => {
    if (!roles.includes(request.user?.role)) {
      reply.code(403).send({ error: "Forbidden" });
    }
  });
});
