import { Worker } from "bullmq";
import { createRedisConnection } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { PLATFORM_QUEUE_NAMES } from "../modules/queue/queue.definitions.js";
import { facebookService } from "../modules/facebook/facebook.service.js";
import { threadsService } from "../modules/threads/threads.service.js";
import { mastodonService } from "../modules/mastodon/mastodon.service.js";
import { createPublishProcessor } from "./publish.processor.js";

// Independent Worker per platform: separate concurrency and rate limit, so
// e.g. Facebook throttling never slows down Mastodon delivery. Run this file
// as its own process (`npm run dev:worker` / `node dist/workers/index.js`),
// scale replicas independently from the API.
const workers = [
  new Worker(PLATFORM_QUEUE_NAMES.facebook, createPublishProcessor("facebook", facebookService.publish), {
    connection: createRedisConnection(),
    concurrency: 5,
    limiter: { max: 200, duration: 60_000 },
  }),
  new Worker(PLATFORM_QUEUE_NAMES.threads, createPublishProcessor("threads", threadsService.publish), {
    connection: createRedisConnection(),
    concurrency: 5,
    limiter: { max: 200, duration: 60_000 },
  }),
  new Worker(PLATFORM_QUEUE_NAMES.mastodon, createPublishProcessor("mastodon", mastodonService.publish), {
    connection: createRedisConnection(),
    concurrency: 10,
    limiter: { max: 300, duration: 60_000 },
  }),
];

for (const worker of workers) {
  worker.on("completed", (job) => logger.info({ queue: worker.name, jobId: job.id }, "job completed"));
  worker.on("failed", (job, err) =>
    logger.error({ queue: worker.name, jobId: job?.id, err: err.message }, "job failed"),
  );
}

logger.info({ queues: workers.map((w) => w.name) }, "publish workers started");

async function shutdown(signal: string) {
  logger.info({ signal }, "worker shutting down");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
