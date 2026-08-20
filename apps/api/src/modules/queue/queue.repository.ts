import { deadLetterQueue, platformQueues, type PlatformKey } from "./queue.definitions.js";

export const queueRepository = {
  getCounts(platform: PlatformKey) {
    return platformQueues[platform].getJobCounts("waiting", "active", "completed", "failed", "delayed");
  },

  getDeadLetterCounts() {
    return deadLetterQueue.getJobCounts("waiting", "completed", "failed");
  },

  async getJobs(platform: PlatformKey, state: "waiting" | "active" | "completed" | "failed" | "delayed", start: number, end: number) {
    const jobs = await platformQueues[platform].getJobs([state], start, end);
    return Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      })),
    );
  },

  async retryJob(platform: PlatformKey, jobId: string) {
    const job = await platformQueues[platform].getJob(jobId);
    if (!job) return false;
    await job.retry();
    return true;
  },

  getWorkers(platform: PlatformKey) {
    return platformQueues[platform].getWorkers();
  },
};
