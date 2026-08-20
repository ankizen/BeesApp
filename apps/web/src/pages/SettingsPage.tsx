import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiKey } from "@/types";

export function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  async function loadKeys() {
    const res = await apiClient.get<{ keys: ApiKey[] }>("/api/api-keys");
    setKeys(res.keys);
  }

  useEffect(() => {
    loadKeys();
  }, []);

  async function createKey(e: FormEvent) {
    e.preventDefault();
    const res = await apiClient.post<{ key: { key: string } }>("/api/api-keys", { name: keyName });
    setNewKey(res.key.key);
    setKeyName("");
    loadKeys();
  }

  async function revokeKey(id: string) {
    await apiClient.delete(`/api/api-keys/${id}`);
    loadKeys();
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    try {
      await apiClient.post("/api/auth/change-password", { currentPassword, newPassword });
      setPasswordMessage("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setPasswordMessage("Could not update password — check your current password.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">API Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {newKey && (
            <div className="rounded border border-amber-400 p-2 text-sm">
              <p className="font-medium">New key (shown once):</p>
              <code className="block break-all">{newKey}</code>
            </div>
          )}
          <form onSubmit={createKey} className="flex gap-2">
            <Input placeholder="Key name" required value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            <Button type="submit">Generate</Button>
          </form>
          <div className="space-y-1">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{key.name}</span>{" "}
                  <span className="text-muted-foreground">({key.keyPrefix}…)</span>
                </div>
                <Button size="sm" variant="destructive" onClick={() => revokeKey(key.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="max-w-sm space-y-3">
            <Input type="password" placeholder="Current password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <Input type="password" placeholder="New password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            {passwordMessage && <p className="text-sm text-muted-foreground">{passwordMessage}</p>}
            <Button type="submit">Update Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
