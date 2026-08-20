import { prisma } from "../../lib/prisma.js";
import { childLogger } from "../../lib/logger.js";
import { isPlatformKey, platformQueues, type PublishJobData } from "../queue/queue.definitions.js";
import { articlesRepository } from "./articles.repository.js";
import type { BulkPublishInput, ListArticlesQuery } from "./articles.schema.js";
import type { WebhookPayload } from "../wordpress/wordpress.schema.js";

const log = childLogger({ module: "articles" });

export class ArticlesError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

export const articlesService = {
  async upsertFromWebhook(wordpressSiteId: string, payload: WebhookPayload) {
    const article = await articlesRepository.upsertFromWebhook(wordpressSiteId, payload);
    await articlesService.enqueuePublishJobs(article.id);
    return article;
  },

  // Fans an article out to every active, auto-publish social account owned
  // by the article's WordPress site's user. One PublishJob + one BullMQ job
  // per (article, account) pair, so platforms fail and retry independently.
  async enqueuePublishJobs(articleId: string) {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { wordpressSite: { select: { userId: true } } },
    });
    if (!article) throw new ArticlesError("Article not found", 404);

    const accounts = await prisma.socialAccount.findMany({
      where: { userId: article.wordpressSite.userId, status: "ACTIVE", isAutoPublish: true },
      include: { platform: true },
    });

    if (accounts.length === 0) {
      log.warn({ articleId }, "no active social accounts to publish to");
      return [];
    }

    const jobs = await Promise.all(
      accounts.map(async (account) => {
        if (!isPlatformKey(account.platform.key)) {
          log.error({ platformKey: account.platform.key }, "unknown platform key, skipping");
          return null;
        }

        const publishJob = await prisma.publishJob.create({
          data: { articleId, socialAccountId: account.id, status: "QUEUED" },
        });

        const data: PublishJobData = {
          publishJobId: publishJob.id,
          articleId,
          socialAccountId: account.id,
        };

        const queue = platformQueues[account.platform.key];
        const bullJob = await queue.add(account.platform.key, data, { jobId: publishJob.id });
        await prisma.publishJob.update({ where: { id: publishJob.id }, data: { bullJobId: bullJob.id } });

        return publishJob;
      }),
    );

    await articlesRepository.setStatus(articleId, "QUEUED");
    return jobs.filter(Boolean);
  },

  async list(userId: string, query: ListArticlesQuery) {
    return articlesRepository.list(userId, query);
  },

  async getDetail(userId: string, id: string) {
    const article = await articlesRepository.findByIdForUser(id, userId);
    if (!article) throw new ArticlesError("Article not found", 404);
    const jobs = await articlesRepository.publishJobsWithLogs(id);
    return { article, jobs };
  },

  // Re-run publish jobs for an article. If it already has jobs, only retries
  // the ones that aren't currently PENDING/QUEUED/PROCESSING; otherwise fans
  // out fresh (same as a webhook delivery).
  async republish(userId: string, id: string) {
    const article = await articlesRepository.findByIdForUser(id, userId);
    if (!article) throw new ArticlesError("Article not found", 404);

    const existingJobs = await prisma.publishJob.findMany({ where: { articleId: id } });
    const inFlight = existingJobs.filter((j) => ["PENDING", "QUEUED", "PROCESSING"].includes(j.status));
    if (inFlight.length > 0) {
      throw new ArticlesError("Article already has publish jobs in progress", 409);
    }

    if (existingJobs.length === 0) {
      return articlesService.enqueuePublishJobs(id);
    }

    // Re-queue every non-in-flight job for this article (success or fail) as
    // a fresh attempt, keyed by a new BullMQ job id so BullMQ doesn't dedupe.
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { id: { in: existingJobs.map((j) => j.socialAccountId) } },
      include: { platform: true },
    });
    const accountsById = new Map(socialAccounts.map((a) => [a.id, a]));

    const retried = await Promise.all(
      existingJobs.map(async (job) => {
        const account = accountsById.get(job.socialAccountId);
        if (!account || !isPlatformKey(account.platform.key)) return null;

        const fresh = await prisma.publishJob.create({
          data: { articleId: id, socialAccountId: job.socialAccountId, status: "QUEUED" },
        });
        const data: PublishJobData = { publishJobId: fresh.id, articleId: id, socialAccountId: job.socialAccountId };
        const bullJob = await platformQueues[account.platform.key].add(account.platform.key, data, {
          jobId: fresh.id,
        });
        await prisma.publishJob.update({ where: { id: fresh.id }, data: { bullJobId: bullJob.id } });
        return fresh;
      }),
    );

    await articlesRepository.setStatus(id, "QUEUED");
    return retried.filter(Boolean);
  },

  async bulkPublish(userId: string, input: BulkPublishInput) {
    const results = await Promise.allSettled(
      input.articleIds.map((articleId) => articlesService.republish(userId, articleId)),
    );
    return {
      succeeded: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    };
  },
};
