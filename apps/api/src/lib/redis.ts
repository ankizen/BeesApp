import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

// Every connection gets an 'error' listener: ioredis is an EventEmitter, and
// Node throws (crashing the process) on an 'error' event with no listener.
// Without this, any transient Redis blip - a reconnect, a timeout - takes
// the whole API/worker process down instead of just logging and retrying.
function onError(client: Redis) {
  client.on("error", (err) => logger.error({ err }, "redis connection error"));
  return client;
}

// BullMQ requires maxRetriesPerRequest: null on any connection it drives
// (queues, workers, schedulers) - it manages its own retry/backoff and
// blocks on this indefinitely by design.
export function createRedisConnection() {
  return onError(new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }));
}

// General-purpose client for caching and @fastify/rate-limit - deliberately
// NOT maxRetriesPerRequest:null. That setting makes every command retry
// forever instead of erroring, which once hung Fastify's plugin
// registration indefinitely on a Redis startup timing hiccup (the process
// stayed alive but never called .listen()). Ordinary commands here should
// fail fast instead.
export const redis = onError(new Redis(env.REDIS_URL));
