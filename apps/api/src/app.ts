import Fastify from "fastify";
import { logger } from "./lib/logger.js";
import jwtPlugin from "./plugins/jwt.js";
import securityPlugin from "./plugins/security.js";
import errorHandlerPlugin from "./plugins/error-handler.js";

import { authRoutes } from "./modules/auth/auth.routes.js";
import { wordpressRoutes } from "./modules/wordpress/wordpress.routes.js";
import { wordpressWebhookRoutes } from "./modules/wordpress/wordpress.webhook.routes.js";
import { articlesRoutes } from "./modules/articles/articles.routes.js";
import { facebookRoutes } from "./modules/facebook/facebook.routes.js";
import { threadsRoutes } from "./modules/threads/threads.routes.js";
import { mastodonRoutes } from "./modules/mastodon/mastodon.routes.js";
import { queueRoutes } from "./modules/queue/queue.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { settingsRoutes } from "./modules/settings/settings.routes.js";
import { apiKeysRoutes } from "./modules/apiKeys/apiKeys.routes.js";

export function buildApp() {
  // logger:false - request/access logging goes through our own pino
  // instance (below) instead of Fastify's built-in one, so every log line
  // (HTTP, worker, publish) shares one format and one child-logger API.
  const app = Fastify({ logger: false, trustProxy: true });

  app.addHook("onResponse", (request, reply, done) => {
    logger.info(
      { method: request.method, url: request.url, statusCode: reply.statusCode, responseTimeMs: Math.round(reply.elapsedTime) },
      "request",
    );
    done();
  });

  app.register(errorHandlerPlugin);
  app.register(securityPlugin);
  app.register(jwtPlugin);

  app.get("/health", async () => ({ status: "ok" }));

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(wordpressRoutes, { prefix: "/api/wordpress-sites" });
  app.register(wordpressWebhookRoutes, { prefix: "/api/webhooks/wordpress" });
  app.register(articlesRoutes, { prefix: "/api/articles" });
  app.register(facebookRoutes, { prefix: "/api/facebook" });
  app.register(threadsRoutes, { prefix: "/api/threads" });
  app.register(mastodonRoutes, { prefix: "/api/mastodon" });
  app.register(queueRoutes, { prefix: "/api/queue" });
  app.register(analyticsRoutes, { prefix: "/api/analytics" });
  app.register(settingsRoutes, { prefix: "/api/settings" });
  app.register(apiKeysRoutes, { prefix: "/api/api-keys" });

  return app;
}
