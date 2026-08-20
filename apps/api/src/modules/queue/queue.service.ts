import { PLATFORM_QUEUE_NAMES, type PlatformKey } from "./queue.definitions.js";
import { queueRepository } from "./queue.repository.js";

const PLATFORMS = Object.keys(PLATFORM_QUEUE_NAMES) as PlatformKey[];

export const queueService = {
  async overview() {
    const [perPlatform, deadLetter] = await Promise.all([
      Promise.all(
        PLATFORMS.map(async (platform) => ({
          platform,
          counts: await queueRepository.getCounts(platform),
          workers: (await queueRepository.getWorkers(platform)).length,
        })),
      ),
      queueRepository.getDeadLetterCounts(),
    ]);

    const totals = perPlatform.reduce(
      (acc, p) => ({
        waiting: acc.waiting + p.counts.waiting,
        active: acc.active + p.counts.active,
        failed: acc.failed + p.counts.failed,
        completed: acc.completed + p.counts.completed,
        delayed: acc.delayed + p.counts.delayed,
      }),
      { waiting: 0, active: 0, failed: 0, completed: 0, delayed: 0 },
    );

    return { totals, perPlatform, deadLetter };
  },

  jobs(platform: PlatformKey, state: "waiting" | "active" | "completed" | "failed" | "delayed", start: number, end: number) {
    return queueRepository.getJobs(platform, state, start, end);
  },

  retryJob(platform: PlatformKey, jobId: string) {
    return queueRepository.retryJob(platform, jobId);
  },
};
