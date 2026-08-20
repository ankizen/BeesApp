import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/types";

type NumericStatKey = Exclude<keyof DashboardStats, "queueBreakdown">;

const TILES: { key: NumericStatKey; label: string }[] = [
  { key: "articlesToday", label: "Articles Today" },
  { key: "articlesThisMonth", label: "Articles This Month" },
  { key: "successfulPublishes", label: "Successful Publishes" },
  { key: "failedPublishes", label: "Failed Publishes" },
  { key: "queueSize", label: "Queue Size" },
  { key: "connectedPlatforms", label: "Connected Platforms" },
];

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    apiClient.get<DashboardStats>("/api/analytics/dashboard").then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {TILES.map(({ key, label }) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stats ? stats[key] : "—"}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
