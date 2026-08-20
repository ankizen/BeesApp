import { z } from "zod";

export const platformParamSchema = z.object({
  platform: z.enum(["facebook", "threads", "mastodon"]),
});

export const jobsQuerySchema = z.object({
  state: z.enum(["waiting", "active", "completed", "failed", "delayed"]).default("waiting"),
  start: z.coerce.number().int().min(0).default(0),
  end: z.coerce.number().int().min(0).default(49),
});
