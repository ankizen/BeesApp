import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WordpressSite } from "@/types";

export function WordpressSitesPage() {
  const [sites, setSites] = useState<WordpressSite[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", username: "", appPassword: "" });
  const [newSecret, setNewSecret] = useState<{ id: string; webhookSecret: string } | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  async function load() {
    const res = await apiClient.get<{ sites: WordpressSite[] }>("/api/wordpress-sites");
    setSites(res.sites);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await apiClient.post<{ site: WordpressSite & { webhookSecret: string } }>("/api/wordpress-sites", form);
    setNewSecret({ id: res.site.id, webhookSecret: res.site.webhookSecret });
    setForm({ name: "", url: "", username: "", appPassword: "" });
    setShowForm(false);
    load();
  }

  async function testConnection(id: string) {
    const res = await apiClient.post<{ ok: boolean; message: string }>(`/api/wordpress-sites/${id}/test-connection`);
    setTestResult((prev) => ({ ...prev, [id]: res.ok ? `✓ ${res.message}` : `✗ ${res.message}` }));
  }

  async function remove(id: string) {
    await apiClient.delete(`/api/wordpress-sites/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">WordPress Sites</h1>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "Add Site"}</Button>
      </div>

      {newSecret && (
        <Card className="border-amber-400">
          <CardContent className="space-y-1 pt-4 text-sm">
            <p className="font-medium">Webhook secret (shown once) — configure this in the WordPress plugin:</p>
            <code className="block break-all rounded bg-muted px-2 py-1">{newSecret.webhookSecret}</code>
            <p className="text-muted-foreground">
              Webhook URL: <code>{import.meta.env.VITE_API_URL}/api/webhooks/wordpress/{newSecret.id}</code>
            </p>
            <Button size="sm" variant="outline" onClick={() => setNewSecret(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Site name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="https://example.com" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <Input placeholder="WP username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <Input
                placeholder="Application password"
                required
                type="password"
                value={form.appPassword}
                onChange={(e) => setForm({ ...form, appPassword: e.target.value })}
              />
              <Button type="submit" className="md:col-span-2">
                Save Site
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sites.map((site) => (
          <Card key={site.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-foreground">{site.name}</CardTitle>
              <Badge variant={site.status === "ACTIVE" ? "success" : "secondary"}>{site.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{site.url}</p>
              <p className="text-muted-foreground">
                Last synced: {site.lastSyncAt ? new Date(site.lastSyncAt).toLocaleString() : "never"}
              </p>
              {testResult[site.id] && <p>{testResult[site.id]}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => testConnection(site.id)}>
                  Test Connection
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(site.id)}>
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
