import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import type { Article, ArticleStatus } from "@/types";

interface ListResponse {
  items: Article[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUSES: ArticleStatus[] = ["PENDING", "QUEUED", "PUBLISHING", "PUBLISHED", "PARTIAL", "FAILED"];

export function ArticlesPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const res = await apiClient.get<ListResponse>(`/api/articles?${params.toString()}`);
    setData(res);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkPublish() {
    if (selected.size === 0) return;
    await apiClient.post("/api/articles/bulk-publish", { articleIds: [...selected] });
    setSelected(new Set());
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Articles</h1>
        <Button disabled={selected.size === 0} onClick={bulkPublish}>
          Bulk Publish ({selected.size})
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
          className="max-w-xs"
        />
        <select
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => (setPage(1), setStatus(e.target.value))}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={() => (setPage(1), load())}>
          Search
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Title</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Published</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.items.map((article) => (
            <TableRow key={article.id}>
              <TableCell>
                <input type="checkbox" checked={selected.has(article.id)} onChange={() => toggle(article.id)} />
              </TableCell>
              <TableCell>
                <Link to={`/articles/${article.id}`} className="font-medium hover:underline">
                  {article.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{article.wordpressSite.name}</TableCell>
              <TableCell>
                <StatusBadge status={article.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{new Date(article.publishedAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} · {data.total} articles
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
