import { z } from "zod";

export const listArticlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  status: z.enum(["PENDING", "QUEUED", "PUBLISHING", "PUBLISHED", "PARTIAL", "FAILED"]).optional(),
  wordpressSiteId: z.string().uuid().optional(),
});
export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;

export const bulkPublishSchema = z.object({
  articleIds: z.array(z.string().uuid()).min(1).max(500),
});
export type BulkPublishInput = z.infer<typeof bulkPublishSchema>;
