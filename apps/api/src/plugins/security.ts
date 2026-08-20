import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import csrfProtection from "@fastify/csrf-protection";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";

export default fp(async function security(app: FastifyInstance) {
  await app.register(helmet, { global: true });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(cookie);

  // CSRF only matters for cookie-authenticated requests (the refresh-token
  // cookie); bearer-token requests aren't vulnerable. Applied per-route
  // (see auth.routes.ts) rather than globally.
  await app.register(csrfProtection, { cookieOpts: { signed: false } });

  // Redis-backed so the limit is shared across every API instance, not
  // per-process - required once this runs behind more than one replica.
  await app.register(rateLimit, {
    redis,
    max: 300,
    timeWindow: "1 minute",
  });
});
