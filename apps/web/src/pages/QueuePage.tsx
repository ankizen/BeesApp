import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Counts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
interface Overview {
  totals: Counts;
  perPlatform: { platform: string; counts: Counts; workers: number }[];
  deadLetter: { waiting: number; completed: number; failed: number };
}
interface QueueJob {
  id: string;
  attemptsMade: number;
  failedReason: string | null;
  timestamp: number;
}

const PLATFORMS = ["facebook", "threads", "mastodon"] as const;

export function QueuePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("facebook");
  const [failedJobs, setFailedJobs] = useState<QueueJob[]>([]);

  async function load() {
    const res = await apiClient.get<Overview>("/api/queue/overview");
    setOverview(res);
  }

  async function loadFailed(p: (typeof PLATFORMS)[number]) {
    const res = await apiClient.get<{ jobs: QueueJob[] }>(`/api/queue/${p}/jobs?state=failed`);
    setFailedJobs(res.jobs);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadFailed(platform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  async function retry(jobId: string) {
    await apiClient.post(`/api/queue/${platform}/jobs/${jobId}/retry`);
    loadFailed(platform);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Queue Monitoring</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {overview &&
          (["waiting", "active", "delayed", "failed", "completed"] as const).map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="capitalize">{key}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{overview.totals[key]}</CardContent>
            </Card>
          ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {overview?.perPlatform.map((p) => (
          <Card key={p.platform}>
            <CardHeader>
              <CardTitle className="capitalize text-foreground">{p.platform}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Waiting: {p.counts.waiting}</p>
              <p>Active: {p.counts.active}</p>
              <p>Failed: {p.counts.failed}</p>
              <p>Workers online: {p.workers}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {overview && (
        <p className="text-sm text-muted-foreground">
          Dead-letter queue: {overview.deadLetter.failed} failed, {overview.deadLetter.waiting} waiting review
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Failed jobs:</span>
        {PLATFORMS.map((p) => (
          <Button key={p} size="sm" variant={p === platform ? "default" : "outline"} onClick={() => setPlatform(p)}>
            {p}
          </Button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job ID</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {failedJobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-mono text-xs">{job.id}</TableCell>
              <TableCell>{job.attemptsMade}</TableCell>
              <TableCell className="max-w-md truncate text-xs text-muted-foreground">{job.failedReason}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline" onClick={() => retry(job.id)}>
                  Retry
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
