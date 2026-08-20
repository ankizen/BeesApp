export interface DashboardStats {
  articlesToday: number;
  articlesThisMonth: number;
  successfulPublishes: number;
  failedPublishes: number;
  connectedPlatforms: number;
  queueSize: number;
  queueBreakdown: { waiting: number; active: number; failed: number; completed: number; delayed: number };
}
