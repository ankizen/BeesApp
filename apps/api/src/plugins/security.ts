import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import csrfProtection from "@fastify/csrf-protection";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

export default fp(async function security(app: FastifyInstance) {
  await app.register(helmet, { global: true });
  logger.info("DIAG: helmet registered");

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  logger.info("DIAG: cors registered");

  await app.register(cookie);
  logger.info("DIAG: cookie registered");

  // CSRF only matters for cookie-authenticated requests (the refresh-token
  // cookie); bearer-token requests aren't vulnerable. Applied per-route
  // (see auth.routes.ts) rather than globally.
  await app.register(csrfProtection, { cookieOpts: { signed: false } });
  logger.info("DIAG: csrf registered");

  // Redis-backed so the limit is shared across every API instance, not
  // per-process - required once this runs behind more than one replica.
  await app.register(rateLimit, {
    redis,
    max: 300,
    timeWindow: "1 minute",
  });
  logger.info("DIAG: rate-limit registered");
});
