import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SocialAccount } from "@/types";

interface FacebookPageOption {
  id: string;
  name: string;
  category?: string;
}

function PlatformSection({
  title,
  accounts,
  onConnect,
  onDisconnect,
  connectLabel = "Connect",
}: {
  title: string;
  accounts: SocialAccount[];
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  connectLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-foreground">{title}</CardTitle>
        <Button size="sm" onClick={onConnect}>
          {connectLabel}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {accounts.length === 0 && <p className="text-sm text-muted-foreground">Not connected.</p>}
        {accounts.map((account) => (
          <div key={account.id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
            <div>
              <div className="font-medium">{account.accountName}</div>
              {account.instanceUrl && <div className="text-xs text-muted-foreground">{account.instanceUrl}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={account.status === "ACTIVE" ? "success" : "destructive"}>{account.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => onDisconnect(account.id)}>
                Disconnect
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ConnectionsPage() {
  const [params, setParams] = useSearchParams();
  const [facebookAccounts, setFacebookAccounts] = useState<SocialAccount[]>([]);
  const [threadsAccounts, setThreadsAccounts] = useState<SocialAccount[]>([]);
  const [mastodonAccounts, setMastodonAccounts] = useState<SocialAccount[]>([]);
  const [pageOptions, setPageOptions] = useState<FacebookPageOption[] | null>(null);
  const [instanceUrl, setInstanceUrl] = useState("");
  const [showMastodonForm, setShowMastodonForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    const [fb, th, ma] = await Promise.all([
      apiClient.get<{ accounts: SocialAccount[] }>("/api/facebook/accounts"),
      apiClient.get<{ accounts: SocialAccount[] }>("/api/threads/accounts"),
      apiClient.get<{ accounts: SocialAccount[] }>("/api/mastodon/accounts"),
    ]);
    setFacebookAccounts(fb.accounts);
    setThreadsAccounts(th.accounts);
    setMastodonAccounts(ma.accounts);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const platform = params.get("platform");
    const err = params.get("error");
    const selectionToken = params.get("selectionToken");

    if (err) {
      setError(err);
      setParams({});
      return;
    }

    if (platform === "facebook" && selectionToken) {
      apiClient.get<{ pages: FacebookPageOption[] }>(`/api/facebook/pages?selectionToken=${selectionToken}`).then((res) => {
        setPageOptions(res.pages);
      });
      setParams({});
      return;
    }

    if (params.get("connected")) {
      loadAll();
      setParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function connectFacebook() {
    const res = await apiClient.get<{ url: string }>("/api/facebook/connect");
    window.location.href = res.url;
  }

  async function selectFacebookPage(pageId: string, selectionToken: string) {
    await apiClient.post("/api/facebook/pages/select", { selectionToken, pageId });
    setPageOptions(null);
    loadAll();
  }

  async function connectThreads() {
    const res = await apiClient.get<{ url: string }>("/api/threads/connect");
    window.location.href = res.url;
  }

  async function connectMastodon(e: FormEvent) {
    e.preventDefault();
    const res = await apiClient.post<{ url: string }>("/api/mastodon/connect", { instanceUrl });
    window.location.href = res.url;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Connections</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {pageOptions && (
        <Card className="border-amber-400">
          <CardHeader>
            <CardTitle className="text-foreground">Select a Facebook Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pageOptions.map((page) => (
              <Button
                key={page.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => selectFacebookPage(page.id, params.get("selectionToken") ?? "")}
              >
                {page.name} {page.category ? `· ${page.category}` : ""}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <PlatformSection
        title="Facebook Pages"
        accounts={facebookAccounts}
        onConnect={connectFacebook}
        onDisconnect={(id) => apiClient.delete(`/api/facebook/accounts/${id}`).then(loadAll)}
      />
      <PlatformSection
        title="Threads"
        accounts={threadsAccounts}
        onConnect={connectThreads}
        onDisconnect={(id) => apiClient.delete(`/api/threads/accounts/${id}`).then(loadAll)}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-foreground">Mastodon</CardTitle>
          <Button size="sm" onClick={() => setShowMastodonForm((s) => !s)}>
            {showMastodonForm ? "Cancel" : "Connect"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showMastodonForm && (
            <form onSubmit={connectMastodon} className="flex gap-2">
              <Input placeholder="https://mastodon.social" value={instanceUrl} onChange={(e) => setInstanceUrl(e.target.value)} required />
              <Button type="submit">Go</Button>
            </form>
          )}
          {mastodonAccounts.length === 0 && <p className="text-sm text-muted-foreground">Not connected.</p>}
          {mastodonAccounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{account.accountName}</div>
                <div className="text-xs text-muted-foreground">{account.instanceUrl}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={account.status === "ACTIVE" ? "success" : "destructive"}>{account.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => apiClient.delete(`/api/mastodon/accounts/${account.id}`).then(loadAll)}>
                  Disconnect
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
