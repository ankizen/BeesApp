import { z } from "zod";

export const createSiteSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  username: z.string().min(1),
  appPassword: z.string().min(1),
});
export type CreateSiteInput = z.infer<typeof createSiteSchema>;

export const updateSiteSchema = createSiteSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;

// Payload sent by the WordPress plugin on publish / manual re-sync.
export const webhookPayloadSchema = z.object({
  postId: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  featuredImage: z.string().url().nullable().optional(),
  excerpt: z.string().default(""),
  publishedDate: z.string(), // ISO 8601
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
