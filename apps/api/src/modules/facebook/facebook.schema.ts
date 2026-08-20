import { z } from "zod";

export const facebookCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const selectPageSchema = z.object({
  selectionToken: z.string().min(1),
  pageId: z.string().min(1),
});
export type SelectPageInput = z.infer<typeof selectPageSchema>;
