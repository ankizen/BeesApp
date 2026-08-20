import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

// Shared connection factory. BullMQ requires maxRetriesPerRequest: null on
// any connection it drives (queues, workers, schedulers).
//
// Every connection gets an 'error' listener: ioredis is an EventEmitter, and
// Node throws (crashing the process) on an 'error' event with no listener.
// Without this, any transient Redis blip - a reconnect, a timeout - takes
// the whole API/worker process down instead of just logging and retrying.
export function createRedisConnection() {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  client.on("error", (err) => logger.error({ err }, "redis connection error"));
  return client;
}

// General-purpose client for caching (dashboard stat counters, etc), separate
// from the BullMQ connections so cache traffic never blocks queue traffic.
export const redis = createRedisConnection();
