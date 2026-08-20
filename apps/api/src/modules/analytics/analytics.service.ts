import { queueService } from "../queue/queue.service.js";
import { analyticsRepository } from "./analytics.repository.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const analyticsService = {
  async dashboard(userId: string) {
    const today = startOfToday();
    const monthStart = startOfMonth();

    const [articlesToday, articlesThisMonth, successfulPublishes, failedPublishes, connectedPlatforms, queueOverview] =
      await Promise.all([
        analyticsRepository.countArticlesSince(userId, today),
        analyticsRepository.countArticlesSince(userId, monthStart),
        analyticsRepository.countPublishJobsByStatus(userId, "SUCCESS", monthStart),
        analyticsRepository.countPublishJobsByStatus(userId, "FAILED", monthStart),
        analyticsRepository.countConnectedPlatforms(userId),
        queueService.overview(),
      ]);

    return {
      articlesToday,
      articlesThisMonth,
      successfulPublishes,
      failedPublishes,
      connectedPlatforms: connectedPlatforms.length,
      queueSize: queueOverview.totals.waiting + queueOverview.totals.active + queueOverview.totals.delayed,
      queueBreakdown: queueOverview.totals,
    };
  },
};
