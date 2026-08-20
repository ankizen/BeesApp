import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import type { Article, PublishJob } from "@/types";

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [republishing, setRepublishing] = useState(false);

  async function load() {
    const res = await apiClient.get<{ article: Article; jobs: PublishJob[] }>(`/api/articles/${id}`);
    setArticle(res.article);
    setJobs(res.jobs);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function republish() {
    setRepublishing(true);
    try {
      await apiClient.post(`/api/articles/${id}/republish`);
      await load();
    } finally {
      setRepublishing(false);
    }
  }

  if (!article) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <Link to="/articles" className="text-sm text-muted-foreground hover:underline">
        ← Back to articles
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{article.title}</h1>
          <a href={article.url} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:underline">
            {article.url}
          </a>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={article.status} />
          <Button size="sm" onClick={republish} disabled={republishing}>
            {republishing ? "Publishing…" : "Republish"}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{article.excerpt}</p>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Publish Jobs</h2>
        <div className="space-y-3">
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">No publish jobs yet.</p>}
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-foreground">
                  {job.socialAccount.platform.name} · {job.socialAccount.accountName}
                </CardTitle>
                <StatusBadge status={job.status} />
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Attempt {job.attempts}/{job.maxAttempts}
                  {job.errorMessage ? ` · ${job.errorMessage}` : ""}
                </p>
                {job.logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs">
                    <span className={log.success ? "text-emerald-600" : "text-red-600"}>
                      {log.success ? "Success" : "Failed"} {log.statusCode ? `(${log.statusCode})` : ""}
                    </span>
                    <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
