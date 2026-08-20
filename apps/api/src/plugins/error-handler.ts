import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

// Any {statusCode, message} thrown by a service maps straight to the HTTP
// response; anything else is logged and returned as a generic 500 (never
// leak internals to the client).
export default fp(async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, request, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "Validation failed", details: err.flatten() });
    }

    const statusCode = (err as { statusCode?: number }).statusCode;
    if (typeof statusCode === "number" && statusCode < 500) {
      return reply.code(statusCode).send({ error: err.message });
    }

    logger.error({ err, url: request.url, method: request.method }, "unhandled request error");
    return reply.code(500).send({ error: "Internal server error" });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: "Not found" });
  });
});
