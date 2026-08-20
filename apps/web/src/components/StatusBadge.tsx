import { Badge } from "@/components/ui/badge";
import type { ArticleStatus } from "@/types";

const VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive" | "warning" | "outline"> = {
  PENDING: "secondary",
  QUEUED: "outline",
  PUBLISHING: "warning",
  PUBLISHED: "success",
  PARTIAL: "warning",
  FAILED: "destructive",
  SUCCESS: "success",
};

export function StatusBadge({ status }: { status: ArticleStatus | string }) {
  return <Badge variant={VARIANTS[status] ?? "secondary"}>{status}</Badge>;
}
