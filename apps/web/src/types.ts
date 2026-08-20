export interface DashboardStats {
  articlesToday: number;
  articlesThisMonth: number;
  successfulPublishes: number;
  failedPublishes: number;
  connectedPlatforms: number;
  queueSize: number;
  queueBreakdown: { waiting: number; active: number; failed: number; completed: number; delayed: number };
}

export type ArticleStatus = "PENDING" | "QUEUED" | "PUBLISHING" | "PUBLISHED" | "PARTIAL" | "FAILED";

export interface Article {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  featuredImageUrl: string | null;
  status: ArticleStatus;
  publishedAt: string;
  createdAt: string;
  categories: string[];
  tags: string[];
  wordpressSite: { id: string; name: string };
}

export interface PublishLog {
  id: string;
  success: boolean;
  statusCode: number | null;
  message: string | null;
  createdAt: string;
}

export interface PublishJob {
  id: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
  socialAccount: { accountName: string; platform: { key: string; name: string } };
  logs: PublishLog[];
}

export interface WordpressSite {
  id: string;
  name: string;
  url: string;
  username: string;
  status: "ACTIVE" | "INACTIVE";
  lastSyncAt: string | null;
  createdAt: string;
}

export interface SocialAccount {
  id: string;
  accountName: string;
  externalAccountId: string;
  instanceUrl: string | null;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  isAutoPublish: boolean;
  platform: { key: string; name: string };
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}
