import { z } from "zod";

export const connectMastodonSchema = z.object({
  instanceUrl: z.string().url(),
});
export type ConnectMastodonInput = z.infer<typeof connectMastodonSchema>;

export const mastodonCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
