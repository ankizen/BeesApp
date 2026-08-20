import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { wordpressController } from "./wordpress.controller.js";

// Public webhook endpoint, mounted at /api/webhooks/wordpress. No JWT - auth
// is the per-site HMAC signature. Scoped plugin so the raw-body parser below
// only applies here, not to the rest of the API.
export async function wordpressWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer", bodyLimit: env.WEBHOOK_MAX_BODY_BYTES },
    (request, body, done) => {
      request.rawBody = body as Buffer;
      try {
        done(null, JSON.parse((body as Buffer).toString("utf8")));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post(
    "/:siteId",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    wordpressController.webhook,
  );

  app.post(
    "/:siteId/ping",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    wordpressController.webhookPing,
  );
}
