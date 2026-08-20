import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { childLogger } from "../lib/logger.js";
import { deadLetterQueue, type PlatformKey, type PublishJobData } from "../modules/queue/queue.definitions.js";
import { recomputeArticleStatus } from "./articleStatus.js";

interface PublishResult {
  externalPostId?: string;
  statusCode: number;
  responseBody: unknown;
}

type PublishFn = (
  article: { title: string; excerpt: string; url: string; featuredImageUrl: string | null },
  account: { id: string; externalAccountId: string; instanceUrl: string | null; accessTokenEnc: string; refreshTokenEnc: string | null; tokenExpiresAt: Date | null },
) => Promise<PublishResult>;

// One processor shape shared by every platform - only the publish call
// differs. Handles the DB side of the pipeline: mark processing, log the
// attempt, decide retry vs terminal failure, roll the article status up.
export function createPublishProcessor(platform: PlatformKey, publish: PublishFn) {
  const log = childLogger({ module: "worker", platform });

  return async function processor(job: Job<PublishJobData>) {
    const data = job.data;
    const publishJob = await prisma.publishJob.findUnique({
      where: { id: data.publishJobId },
      include: { article: true, socialAccount: true },
    });
    if (!publishJob) {
      throw new UnrecoverableError(`PublishJob ${data.publishJobId} not found`);
    }

    await prisma.publishJob.update({
      where: { id: publishJob.id },
      data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
    });

    try {
      const result = await publish(publishJob.article, publishJob.socialAccount);

      await prisma.$transaction([
        prisma.publishJob.update({
          where: { id: publishJob.id },
          data: { status: "SUCCESS", finishedAt: new Date(), errorMessage: null },
        }),
        prisma.publishLog.create({
          data: {
            publishJobId: publishJob.id,
            platform,
            success: true,
            statusCode: result.statusCode,
            message: result.externalPostId ? `Published (${result.externalPostId})` : "Published",
            responseBody: result.responseBody as object,
          },
        }),
      ]);
      await recomputeArticleStatus(publishJob.articleId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const statusCode = (err as { statusCode?: number }).statusCode ?? null;
      const responseBody = (err as { responseBody?: unknown }).responseBody ?? null;
      const retryable = (err as { retryable?: boolean }).retryable !== false;

      await prisma.publishLog.create({
        data: { publishJobId: publishJob.id, platform, success: false, statusCode, message, responseBody: responseBody as object },
      });

      const maxAttempts = job.opts.attempts ?? 1;
      const outOfRetries = job.attemptsMade + 1 >= maxAttempts;

      if (outOfRetries || !retryable) {
        await prisma.publishJob.update({
          where: { id: publishJob.id },
          data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
        });
        await deadLetterQueue.add(platform, data, { jobId: `dlq:${publishJob.id}:${job.attemptsMade}` });
        await recomputeArticleStatus(publishJob.articleId);
        log.error({ publishJobId: publishJob.id, message }, "publish job moved to dead-letter queue");
        if (!retryable) throw new UnrecoverableError(message);
        throw err;
      }

      await prisma.publishJob.update({
        where: { id: publishJob.id },
        data: { status: "QUEUED", errorMessage: message },
      });
      log.warn({ publishJobId: publishJob.id, attempt: job.attemptsMade + 1, maxAttempts }, "publish attempt failed, will retry");
      throw err;
    }
  };
}
