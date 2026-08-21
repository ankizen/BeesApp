import { prisma } from "../lib/prisma.js";

type JobStatus = "PENDING" | "QUEUED" | "PROCESSING" | "SUCCESS" | "FAILED";
type ArticleStatus = "PUBLISHING" | "PUBLISHED" | "FAILED" | "PARTIAL";

// Pure decision logic, separated from the DB read/write so it's unit
// testable without a database.
export function decideArticleStatus(jobs: { status: JobStatus }[]): ArticleStatus {
  const terminal = jobs.every((j) => j.status === "SUCCESS" || j.status === "FAILED");
  if (!terminal) return "PUBLISHING";

  const successCount = jobs.filter((j) => j.status === "SUCCESS").length;
  if (successCount === jobs.length) return "PUBLISHED";
  if (successCount === 0) return "FAILED";
  return "PARTIAL";
}

// Rolls an article's status up from the state of all its publish jobs.
// Called after every job reaches a terminal state (SUCCESS/FAILED).
export async function recomputeArticleStatus(articleId: string) {
  const jobs = await prisma.publishJob.findMany({ where: { articleId }, select: { status: true } });
  if (jobs.length === 0) return;

  await prisma.article.update({ where: { id: articleId }, data: { status: decideArticleStatus(jobs) } });
}
