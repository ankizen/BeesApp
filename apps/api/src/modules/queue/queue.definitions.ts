import { Queue } from "bullmq";
import { createRedisConnection } from "../../lib/redis.js";

// One queue per platform: independent concurrency, rate limits, and backoff
// per platform, and one platform's backlog never blocks another's.
// Adding a platform (LinkedIn, Bluesky, ...) means adding one entry here.
export const PLATFORM_QUEUE_NAMES = {
  facebook: "publish:facebook",
  threads: "publish:threads",
  mastodon: "publish:mastodon",
} as const;

export type PlatformKey = keyof typeof PLATFORM_QUEUE_NAMES;

export const DEAD_LETTER_QUEUE_NAME = "publish:dead-letter";

const connection = createRedisConnection();

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7, count: 5_000 }, // 7 days
  removeOnFail: false as const, // keep failed jobs visible until moved to DLQ / retried
};

export const platformQueues: Record<PlatformKey, Queue> = {
  facebook: new Queue(PLATFORM_QUEUE_NAMES.facebook, { connection, defaultJobOptions }),
  threads: new Queue(PLATFORM_QUEUE_NAMES.threads, { connection, defaultJobOptions }),
  mastodon: new Queue(PLATFORM_QUEUE_NAMES.mastodon, { connection, defaultJobOptions }),
};

export const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, {
  connection,
  defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
});

export interface PublishJobData {
  publishJobId: string;
  articleId: string;
  socialAccountId: string;
}

export function isPlatformKey(value: string): value is PlatformKey {
  return value in PLATFORM_QUEUE_NAMES;
}
