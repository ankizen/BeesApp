import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  wordpressSiteId: z.string().uuid().optional(),
  scopes: z.array(z.string()).default(["webhook:write"]),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
