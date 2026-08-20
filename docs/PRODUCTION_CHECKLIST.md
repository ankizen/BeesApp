# Production Readiness Checklist

## Before first deploy

- [ ] `JWT_ACCESS_SECRET` and `ENCRYPTION_KEY` generated with `openssl rand -hex 32`, unique per environment, never committed.
- [ ] `POSTGRES_PASSWORD` is a generated secret, not the `.env.example` placeholder.
- [ ] `CORS_ORIGIN` set to the exact frontend origin (no wildcard).
- [ ] `SEED_OWNER_PASSWORD` changed immediately after first login (Settings → Change Password).
- [ ] Facebook/Threads app credentials configured with the production redirect URIs registered in the Meta developer console (must match `FACEBOOK_REDIRECT_URI` / `THREADS_REDIRECT_URI` exactly).
- [ ] TLS terminated in front of both `api` and `web` (Coolify/Traefik handles this if domains are configured with HTTPS).

## Data safety

- [ ] Automated Postgres backups scheduled (this is the only durable store — Redis holds transient queue/OAuth state).
- [ ] `ENCRYPTION_KEY` backed up somewhere outside the DB backup — losing it makes every stored OAuth token and WordPress application password unrecoverable (accounts would need to be reconnected).
- [ ] Migration strategy confirmed: `prisma migrate deploy` runs automatically on API container start (see `docker-compose.yml`); for zero-downtime schema changes with multiple API replicas, review migrations for backward compatibility before deploying.

## Scaling knobs (already wired, tune as volume grows)

- [ ] Worker concurrency per platform (`apps/api/src/workers/index.ts` — `concurrency` and `limiter` options) tuned against each platform's real rate limits, not the placeholder defaults shipped here.
- [ ] `worker` service replica count scaled independently of `api` once queue backlogs (visible on the Queue Monitoring page) grow — BullMQ workers are safe to run as many replicas as needed against the same Redis.
- [ ] Postgres indexes (`articles.status`, `.createdAt`, `.wordpressSiteId`; `publish_jobs.status`, `.socialAccountId`, `.articleId`, `.createdAt`; `publish_logs.publishJobId`, `.success`, `.createdAt`) already match the query patterns used by the Articles/Queue/Analytics pages — re-run `EXPLAIN ANALYZE` on slow queries before adding more.
- [ ] `PublishLog` is append-only and will be the fastest-growing table at high volume; plan a retention/archival job (e.g. delete or move logs older than N days) before it becomes the largest table.

## Security

- [ ] Rate limiting (`@fastify/rate-limit`, Redis-backed) is active on all routes by default (300 req/min) and tighter on `/api/auth/login` (10/min) and the WordPress webhook (60/min per site) — revisit these ceilings against real traffic.
- [ ] Webhook signature verification (`X-Content-Hub-Signature`, HMAC-SHA256) is required on every WordPress webhook call; the per-site secret is shown once at site-creation time and stored encrypted.
- [ ] CSRF protection (`@fastify/csrf-protection`) guards the cookie-authenticated refresh/logout endpoints; all other endpoints use bearer JWTs, which aren't CSRF-vulnerable.
- [ ] OAuth tokens, WordPress application passwords, and webhook secrets are encrypted at rest (AES-256-GCM, `ENCRYPTION_KEY`) — confirm this key is never logged or exposed via an API response (`toPublicSite`/`withoutSecrets` helpers strip it from every response already).
- [ ] Refresh tokens are single-use and rotated on every refresh; a password change revokes all of a user's refresh tokens.
- [ ] Run `npm audit` periodically (dependencies are pinned but not frozen against future CVEs).

## Observability

- [ ] Structured JSON logs (Pino) go to stdout for both `api` and `worker` — wire up log collection (Loki, CloudWatch, etc.) at the infra level; logs are deliberately **not** stored in Postgres to avoid an unbounded table at 10k+ articles/day.
- [ ] `GET /health` wired to your uptime monitor.
- [ ] Queue Monitoring page / `GET /api/queue/overview` wired to an alert if `failed` or the dead-letter queue count grows unexpectedly.

## Known simplifications (see `ponytail:`-style notes in code)

- No automated Threads token-refresh scheduler yet — `threadsService.refreshIfNeeded` runs inline before each publish; add a periodic BullMQ repeatable job if publish-time latency from refreshes becomes noticeable.
- Worker rate limits (`apps/api/src/workers/index.ts`) are reasonable placeholder defaults, not measured against your actual Meta/Mastodon API quotas.
- `ApiKey` model and endpoints exist (creation, listing, revocation) but nothing currently authenticates against them — they're ready for a future external API surface (RSS ingestion, third-party integrations) without a schema change.
- Facebook page-selection and Mastodon/OAuth "pending connection" state is cached in Redis with a 10-minute TTL, not persisted — an interrupted OAuth flow just needs to be restarted.
