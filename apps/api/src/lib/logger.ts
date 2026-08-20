import pino from "pino";
import { isProd } from "../config/env.js";

// Structured JSON logs to stdout. In production these are collected by
// whatever the host runs (Loki/CloudWatch/etc) - we deliberately do NOT
// write request/worker logs into Postgres, that table would outgrow the
// business data (articles, jobs) within days at 10k articles/day.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: isProd ? undefined : { target: "pino-pretty", options: { colorize: true } },
  base: { service: "content-hub-api" },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
