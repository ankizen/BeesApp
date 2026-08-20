# Content Hub

Self-hosted service that receives newly published WordPress articles via webhook and distributes them to Facebook Pages, Threads, and Mastodon.

Modular monolith: one Fastify API, one Postgres database, one Redis instance driving BullMQ queues. Workers run as a separate process so they scale independently of the API and of each other (one BullMQ queue per platform).

## Architecture

```
WordPress (plugin) --webhook (HMAC-signed)--> API --stores Article, enqueues jobs--> Redis (BullMQ)
                                                                                          |
                                                              +---------------------------+---------------------------+
                                                              |                           |                           |
                                                       facebook worker              threads worker              mastodon worker
                                                              |                           |                           |
                                                        Facebook Graph API          Threads API                 Mastodon API
```

- **Webhook response is < 500ms**: the handler verifies the HMAC signature, upserts the `Article` row, creates one `PublishJob` per connected social account, and enqueues one BullMQ job per job. No outbound social API call happens in the request path.
- **One queue per platform** (`publish:facebook`, `publish:threads`, `publish:mastodon`) so a Facebook outage or rate limit never blocks Threads/Mastodon delivery. Each has its own concurrency and rate limiter in `apps/api/src/workers/index.ts`.
- **Retries**: BullMQ exponential backoff (5 attempts by default, see `queue.definitions.ts`).
- **Dead-letter queue**: `publish:dead-letter` receives a copy of every job that exhausts its retries or hits a non-retryable error, for manual inspection/replay (see Queue Monitoring page).
- **Article status** (`PENDING → QUEUED → PUBLISHING → PUBLISHED/PARTIAL/FAILED`) is rolled up from its `PublishJob` children after every terminal job (`workers/articleStatus.ts`).
- **SocialPlatform is a DB table, not an enum** — adding LinkedIn/Bluesky/Telegram/etc later is a seed row plus a new queue + worker + module, not a migration.

## Repo layout

```
apps/api/            Fastify + Prisma + BullMQ backend
  prisma/schema.prisma
  src/modules/        auth, wordpress, articles, facebook, threads, mastodon, queue, analytics, settings, apiKeys
                       each module: controller / service / repository / schema / routes
  src/workers/        BullMQ Worker processes (run as a separate container/process from the API)
apps/web/             React + Vite + TypeScript + Tailwind + shadcn-style UI
wordpress-plugin/     WordPress plugin (PHP) that sends the webhook
docker-compose.yml    postgres, redis, api, worker, web
docs/                 Coolify deployment guide, production checklist
```

## Local development

Requires Node 20+, Docker (for Postgres/Redis only), and npm workspaces.

```bash
cp .env.example .env          # fill in secrets - see below
npm install
docker compose up -d postgres redis
npm run prisma:migrate -w apps/api   # apply schema
npm run prisma:seed -w apps/api      # seeds SocialPlatform rows + an owner user

npm run dev:api      # Fastify on :4000
npm run dev:worker   # BullMQ workers (separate process)
npm run dev:web       # Vite on :5173
```

Generate the required secrets:

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY (must be exactly 32 bytes / 64 hex chars)
```

### Connecting WordPress

1. In the Content Hub UI, go to **WordPress Sites → Add Site**. Enter the site URL, a WordPress username, and an [Application Password](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/) (Users → Profile → Application Passwords).
2. Content Hub shows a webhook URL and secret **once** — copy both.
3. Install `wordpress-plugin/` on the WordPress site, go to **Settings → Content Hub**, paste the URL/secret, click **Test Connection**.
4. Publish a post. It should appear under **Articles** within a second or two, with jobs queued for every connected, auto-publish-enabled social account.

### Connecting social accounts

Facebook and Threads require a Meta developer app (`FACEBOOK_APP_ID`/`SECRET`, `THREADS_APP_ID`/`SECRET` in `.env`) with the redirect URIs registered exactly as configured. Mastodon needs no pre-registered app — Content Hub registers one dynamically per instance on first connect.

## Caption format

Fixed, no AI involved:

```
TITLE

EXCERPT

Read More:
URL
```

See `apps/api/src/lib/caption.ts`.

## Scripts

| Command | What |
|---|---|
| `npm run dev:api` | API in watch mode |
| `npm run dev:worker` | Workers in watch mode |
| `npm run dev:web` | Frontend dev server |
| `npm run build` | Build API + frontend for production |
| `npm run prisma:migrate` | Apply Prisma migrations (dev) |
| `npm run prisma:seed` | Seed social platforms + owner user |

## Further reading

- [docs/COOLIFY_DEPLOYMENT.md](docs/COOLIFY_DEPLOYMENT.md)
- [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md)
