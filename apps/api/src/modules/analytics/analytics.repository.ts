import { prisma } from "../../lib/prisma.js";

export const analyticsRepository = {
  countArticlesSince(userId: string, since: Date) {
    return prisma.article.count({
      where: { wordpressSite: { userId }, createdAt: { gte: since } },
    });
  },

  countPublishJobsByStatus(userId: string, status: "SUCCESS" | "FAILED", since: Date) {
    return prisma.publishJob.count({
      where: {
        status,
        createdAt: { gte: since },
        article: { wordpressSite: { userId } },
      },
    });
  },

  countConnectedPlatforms(userId: string) {
    return prisma.socialAccount.groupBy({
      by: ["platformId"],
      where: { userId, status: "ACTIVE" },
    });
  },

  countActiveSocialAccounts(userId: string) {
    return prisma.socialAccount.count({ where: { userId, status: "ACTIVE" } });
  },
};
