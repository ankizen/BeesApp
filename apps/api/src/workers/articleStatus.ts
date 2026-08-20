import { prisma } from "../lib/prisma.js";

// Rolls an article's status up from the state of all its publish jobs.
// Called after every job reaches a terminal state (SUCCESS/FAILED).
export async function recomputeArticleStatus(articleId: string) {
  const jobs = await prisma.publishJob.findMany({ where: { articleId }, select: { status: true } });
  if (jobs.length === 0) return;

  const terminal = jobs.every((j) => j.status === "SUCCESS" || j.status === "FAILED");
  if (!terminal) {
    await prisma.article.update({ where: { id: articleId }, data: { status: "PUBLISHING" } });
    return;
  }

  const successCount = jobs.filter((j) => j.status === "SUCCESS").length;
  const status = successCount === jobs.length ? "PUBLISHED" : successCount === 0 ? "FAILED" : "PARTIAL";
  await prisma.article.update({ where: { id: articleId }, data: { status } });
}
