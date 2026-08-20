import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { ListArticlesQuery } from "./articles.schema.js";
import type { WebhookPayload } from "../wordpress/wordpress.schema.js";

export const articlesRepository = {
  upsertFromWebhook(wordpressSiteId: string, payload: WebhookPayload) {
    return prisma.article.upsert({
      where: { wordpressSiteId_wpPostId: { wordpressSiteId, wpPostId: payload.postId } },
      create: {
        wordpressSiteId,
        wpPostId: payload.postId,
        title: payload.title,
        slug: slugify(payload.title),
        url: payload.url,
        excerpt: payload.excerpt,
        featuredImageUrl: payload.featuredImage ?? null,
        publishedAt: new Date(payload.publishedDate),
        categories: payload.categories,
        tags: payload.tags,
        status: "PENDING",
      },
      update: {
        title: payload.title,
        url: payload.url,
        excerpt: payload.excerpt,
        featuredImageUrl: payload.featuredImage ?? null,
        categories: payload.categories,
        tags: payload.tags,
      },
    });
  },

  findById(id: string) {
    return prisma.article.findUnique({
      where: { id },
      include: { wordpressSite: { select: { id: true, name: true, userId: true } } },
    });
  },

  findByIdForUser(id: string, userId: string) {
    return prisma.article.findFirst({
      where: { id, wordpressSite: { userId } },
      include: { wordpressSite: { select: { id: true, name: true } } },
    });
  },

  async list(userId: string, query: ListArticlesQuery) {
    const where: Prisma.ArticleWhereInput = {
      wordpressSite: { userId },
      ...(query.status ? { status: query.status } : {}),
      ...(query.wordpressSiteId ? { wordpressSiteId: query.wordpressSiteId } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: "insensitive" as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { wordpressSite: { select: { id: true, name: true } } },
      }),
      prisma.article.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  setStatus(id: string, status: Prisma.ArticleUpdateInput["status"]) {
    return prisma.article.update({ where: { id }, data: { status } });
  },

  publishJobsWithLogs(articleId: string) {
    return prisma.publishJob.findMany({
      where: { articleId },
      include: {
        logs: { orderBy: { createdAt: "desc" } },
        socialAccount: { include: { platform: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}
