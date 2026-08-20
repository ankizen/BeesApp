import { Redis } from "ioredis";
import { env } from "../config/env.js";

// Shared connection factory. BullMQ requires maxRetriesPerRequest: null on
// any connection it drives (queues, workers, schedulers).
export function createRedisConnection() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

// General-purpose client for caching (dashboard stat counters, etc), separate
// from the BullMQ connections so cache traffic never blocks queue traffic.
export const redis = createRedisConnection();
