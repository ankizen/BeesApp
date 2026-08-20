# Deploying to Coolify

Content Hub is a plain `docker-compose.yml` with five services (`postgres`, `redis`, `api`, `worker`, `web`), which Coolify can run natively as a "Docker Compose" resource.

## 1. Create the resource

1. In Coolify: **New Resource → Docker Compose**.
2. Point it at this repository, branch `main` (or whichever you deploy from), compose file `docker-compose.yml`.
3. Coolify will detect the five services. Give the project a name (e.g. `content-hub`).

## 2. Environment variables

Set these in Coolify's **Environment Variables** tab for the project (they populate `.env` for the compose build) — do not commit real secrets:

```
POSTGRES_USER=content_hub
POSTGRES_PASSWORD=<generate a strong password>
POSTGRES_DB=content_hub
DATABASE_URL=postgresql://content_hub:<same password>@postgres:5432/content_hub?schema=public
REDIS_URL=redis://redis:6379

JWT_ACCESS_SECRET=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 32>   # exactly 64 hex chars

APP_BASE_URL=https://api.yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com

FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_REDIRECT_URI=https://api.yourdomain.com/api/facebook/callback

THREADS_APP_ID=...
THREADS_APP_SECRET=...
THREADS_REDIRECT_URI=https://api.yourdomain.com/api/threads/callback

SEED_OWNER_EMAIL=you@yourdomain.com
SEED_OWNER_PASSWORD=<temporary - change on first login>
```

`postgres` and `redis` in the URLs above are the Docker Compose service names — Coolify keeps the internal network, so these resolve without any extra config.

## 3. Domains

Attach two domains in Coolify:

- `api.yourdomain.com` → the `api` service, container port `4000`. Enable HTTPS (Coolify/Let's Encrypt handles this).
- `app.yourdomain.com` → the `web` service, container port `80`.

The `web` build needs `VITE_API_URL` baked in at build time (it's a static SPA, not server-rendered). Coolify passes compose build args from the environment automatically as configured in `docker-compose.yml`'s `args: VITE_API_URL: ${APP_BASE_URL}` — set `APP_BASE_URL` to your public API URL before the first build.

## 4. Deploy

Click **Deploy**. Coolify builds all five images and starts the stack. The `api` service's start command runs `prisma migrate deploy` before starting the server, so schema migrations apply automatically on every deploy.

On the very first deploy, migrations create the schema and `npm run prisma:seed` (run once manually via Coolify's terminal/exec on the `api` container, or add it as a one-off command) seeds the `SocialPlatform` rows and the owner user:

```bash
# In the api container's shell (Coolify → Resource → api → Terminal)
npm run prisma:seed -w apps/api
```

Log in with `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`, then change the password immediately from **Settings**.

## 5. Scaling workers

Each social platform has its own BullMQ queue and its own `Worker` inside the `worker` service. To handle higher volume (10,000+ articles/day), scale the `worker` service horizontally — Coolify exposes a replica count per service (backed by `deploy.replicas` in the compose file). Multiple worker containers consuming the same Redis-backed queues is safe by design (BullMQ guarantees a job is only processed by one worker at a time).

The `api` service can also be scaled to multiple replicas; it's stateless (JWT auth, Redis-backed rate limiting), so this is safe behind Coolify's load balancer.

## 6. Backups

Point Coolify's scheduled backup feature (or a cron job) at the `postgres` volume, or run `pg_dump` against the `postgres` service on a schedule. Redis holds only queue state and short-lived OAuth flow data — it does not need to be backed up (a Redis restart loses in-flight queue jobs; only `PublishJob` rows in Postgres are the durable business record).

## 7. Health checks

- `GET https://api.yourdomain.com/health` → `{"status":"ok"}` once the API is up.
- Queue Monitoring page (`/queue` in the web app) shows worker counts per platform — if "Workers online" is 0 for a platform, that worker container isn't connected to Redis.
