import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { deadLetterQueue, platformQueues } from "./modules/queue/queue.definitions.js";

const app = buildApp();

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  await app.close();
  await Promise.all([...Object.values(platformQueues).map((q) => q.close()), deadLetterQueue.close()]);
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

app
  .listen({ host: env.HOST, port: env.PORT })
  .then(() => logger.info({ port: env.PORT }, "content-hub api listening"))
  .catch((err) => {
    logger.error({ err }, "failed to start server");
    process.exit(1);
  });
