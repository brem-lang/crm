# Deployment Guide

This document describes how to deploy the CRM to production. It covers the frontend build/release, the self-hosted Supabase backend (database migrations, Edge Functions, secrets, scheduled jobs), and the VPS/nginx setup currently used in production, plus a full checklist for standing this up on a brand-new server.

For local development setup, see [QUICKSTART.md](QUICKSTART.md) and [INSTALLATION.md](INSTALLATION.md).

## Architecture Overview

```
Browser
  │
  ▼
nginx (in the crm-app container — TLS via Let's Encrypt)
  │  proxies /auth, /rest, /realtime, /functions, /storage → Kong
  ▼
Self-hosted Supabase (Docker Compose stack: Kong, Postgres, Auth, Realtime, Storage, Edge Functions runtime)
  ├─ PostgreSQL — schema lives entirely in supabase/migrations/ (126 files, timestamp-ordered)
  ├─ Edge Functions — Deno, supabase/functions/ (30 functions), volume-mounted into the edge-runtime container
  └─ pg_cron — 2 scheduled jobs (poll-lead-status, purge-soft-deleted-records), registered by migrations
```

- **Frontend**: static React/Vite build, served by nginx inside the `crm-app` Docker container. That same container's nginx also reverse-proxies to the Supabase stack and terminates TLS for the whole domain.
- **Backend**: the official self-hosted Supabase Docker Compose project (Postgres + Auth + Realtime + Storage + Edge Functions + Kong), running as its own set of containers alongside `crm-app` on the same host.
- **There is no CI/CD pipeline and no Supabase-CLI-linked project** — this instance is *not* a hosted Supabase project managed via `supabase link`/`supabase db push`/`supabase functions deploy`. Deploys are performed manually: migrations are applied directly against `supabase-db` via `psql`, and edge functions are deployed by copying their `index.ts` into the running container's mounted volume and restarting it. Keep using that same process — don't reach for the Supabase CLI flow, it doesn't apply here.

## Environment Variables

The frontend reads these at build time (from `.env.production`, picked up automatically by `vite build`):

```
VITE_SUPABASE_URL=https://<domain>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
```

Never commit real production secrets — `.env.production` should hold the values for whichever instance you're building against, and shouldn't leak elsewhere.

Edge Functions read these from the Supabase Docker Compose `functions` service's `environment:` block (`docker-compose.yml`), not from `supabase secrets`:

| Var | Used by | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | most functions | Project URL, for the service-role client (defaults to `http://kong:8000` inside the Docker network) |
| `SUPABASE_SERVICE_ROLE_KEY` | almost every function | Bypasses RLS for admin/service operations |
| `TRACKING_BASE_URL` | tracking/autologin/injection functions | Public-facing base URL used in generated links — must be the real external domain, not `kong:8000` |
| `PUBLIC_SUPABASE_URL` / `PUBLIC_URL` | a few lead-intake functions | Public-facing URL used in generated links |
| `HTTP_PROXY` / `HTTPS_PROXY` | outbound adapter calls | Egress proxy some advertiser integrations route through — see the IP-whitelisting note in the fresh-install section below |
| `VPS_URL` | `vps-health` | This server's own public URL, pinged to populate the VPS status indicator on the Monitoring page — must be this server's domain, not another instance's. Falls back to `https://backend.marketlinkco.live` if unset, so it must be set explicitly on every server other than the original one |

## 1. Database Migrations

All schema changes (tables, RLS policies, triggers, RPC functions, `pg_cron` job registrations) live in `supabase/migrations/`, applied in timestamp order. There is no separate "seed" step — the migrations *are* the schema, built up incrementally from the very first one.

Apply pending migrations directly against the running `supabase-db` container:

```bash
docker cp <migration-file>.sql supabase-db:/tmp/migration.sql
docker exec supabase-db psql -U postgres -d postgres -f /tmp/migration.sql
```

(Or loop over multiple new files in timestamp order.)

After applying any migration that adds/renames/drops a table, column, or RPC function, **reload the PostgREST schema cache** — skipping this causes "could not find X in the schema cache" errors even though the migration succeeded:

```bash
docker exec supabase-db psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
```

Double-check any migration involving `pg_cron` actually registered the job:

```sql
SELECT jobid, jobname, schedule, active FROM cron.job;
```

## 2. Edge Functions

Deploying a function means copying its source into the mounted volume the `supabase-edge-functions` container reads from, then restarting that container so it picks up the change:

```bash
cp supabase/functions/<fn>/index.ts /path/to/supabase-project/volumes/functions/<fn>/index.ts
docker restart supabase-edge-functions
```

Every function in this project runs with `VERIFY_JWT=false` at the container level (see `FUNCTIONS_VERIFY_JWT` in `.env`) — auth is handled per-endpoint via a custom `Api-Key` header (validated against `admin_api_keys` or `affiliates`/`advertisers` tables), not Supabase JWTs. Leave that setting alone.

After deploying, verify health:

```bash
curl -X POST https://<domain>/functions/v1/<fn> -H "Content-Type: application/json" -d '{"health_check":true}'
# → {"status":"ok","function":"<fn>"}
```

## 3. Frontend Build & Release

```bash
npm run build
```

This runs:
```
cp index.source.html index.html && vite build && rm -f assets/index-*.js assets/index-*.css && cp dist/assets/* assets/ && cp dist/index.html index.html
```

It swaps in the production HTML entrypoint and syncs compiled assets into the repo's gitignored `assets/` directory (used only by the Apache/cPanel PHP fallback path — the Docker image below does its own fresh build inside the container and doesn't read from `assets/`). Always run this (not `vite build` directly), and always confirm it completes with no TypeScript errors. After building, `git checkout -- index.html` to avoid committing the swapped-in production HTML.

### Option A — Docker/nginx (current production setup)

```bash
docker stop crm-app && docker rm crm-app
docker build -t crm-app .
docker run -d --name crm-app -p 80:80 -p 443:443 -v /etc/letsencrypt:/etc/letsencrypt:ro --restart always crm-app
```

The `Dockerfile` builds the app with Node inside the image (its own `npm ci && vite build`), then copies `dist/` into an `nginx:alpine` image alongside `nginx.conf`. `nginx.conf` terminates TLS (Let's Encrypt certs under `/etc/letsencrypt/live/...`), rate-limits `/auth/v1/token`, and proxies `/auth/`, `/rest/`, `/realtime/`, `/functions/`, `/storage/` to the Supabase stack. Update `server_name`, both `ssl_certificate*` paths, and every `proxy_pass` target in `nginx.conf` if the domain or backend host changes.

### Option B — Apache/cPanel

See [INSTALLATION.md](INSTALLATION.md) for the full Apache/cPanel deployment guide (uses `index.php` / `get-crm-config.php` as PHP fallbacks and `.htaccess` for routing — this is the path that actually consumes the `assets/` directory synced by `npm run build`).

## 4. Fresh Install on a New Server

Use this when standing up an entirely new instance (new server, new domain, empty database) rather than pushing an update to the existing production instance.

### 4.0 Prerequisites
- Ubuntu/Debian (or RHEL-family) VPS, Docker + Compose plugin installed
- Ports 80/443 open
- A domain/subdomain with its DNS **A record already pointed at the new server's IP** (required before requesting a TLS cert)

### 4.1 Bring up the Supabase stack
```bash
cd supabase/docker
sh setup.sh -y   # bootstraps .env, generates secrets, brings up docker compose
```
In the generated `.env`, set:
- `API_EXTERNAL_URL`, `SITE_URL`, `SUPABASE_PUBLIC_URL` → `https://<new-domain>`
- `PROXY_DOMAIN`, `CERTBOT_EMAIL` → new domain / your email
- Regenerate `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `DASHBOARD_PASSWORD` — never reuse production secrets on a new server (`setup.sh`/`utils/*.sh` generate fresh ones)
- Keep `FUNCTIONS_VERIFY_JWT=false`

```bash
docker compose up -d
```

### 4.2 Apply the CRM schema
```bash
for f in $(ls supabase/migrations/*.sql | sort); do
  docker exec -i supabase-db psql -U postgres -d postgres < "$f" || break
done
docker exec supabase-db psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
docker exec supabase-db psql -U postgres -d postgres -c "SELECT jobid, jobname, schedule, active FROM cron.job;"
```

### 4.3 Deploy edge functions
```bash
for d in supabase/functions/*/; do
  fn=$(basename "$d")
  mkdir -p /path/to/supabase-project/volumes/functions/"$fn"
  cp "$d/index.ts" /path/to/supabase-project/volumes/functions/"$fn"/index.ts
done
docker restart supabase-edge-functions
```
In the Supabase project's `docker-compose.yml`, under the `functions` service's `environment:`, update:
- `TRACKING_BASE_URL: https://<new-domain>`
- Remove/update `HTTP_PROXY`/`HTTPS_PROXY` — this egress proxy exists on the current server because some advertiser integrations require calls to come from a whitelisted IP. See 4.8.

### 4.4 Update hardcoded domain references before building
- `nginx.conf`: `server_name`, both `ssl_certificate*` paths, all 6 `proxy_pass` targets (should point at the new server's Kong endpoint, typically `127.0.0.1:8000` if Kong and nginx share a host)
- `VPS_URL` env var in this server's `docker-compose.yml` `functions` environment block, set to this server's own public URL (see the Environment Variables table above) — the `vps-health` function no longer has this hardcoded in source
- `.env.production`: `VITE_SUPABASE_URL` → new domain, `VITE_SUPABASE_PUBLISHABLE_KEY` → the new `ANON_KEY` from step 4.1

### 4.5 TLS certificate
```bash
certbot certonly --standalone -d <new-domain>
```
Mount the resulting `/etc/letsencrypt` into `crm-app` as in the `docker run` command in Option A above.

### 4.6 Build and run the frontend container
Follow Option A above (`npm run build` → `docker build` → `docker run`).

### 4.7 Bootstrap the first user
A fresh database has no `auth.users` rows. Create the first account (Supabase Studio's Auth UI is simplest for the very first one), then promote it:
```sql
INSERT INTO user_roles (user_id, role) VALUES ('<uid>', 'super_admin');
```

### 4.8 Advertiser IP whitelisting — don't skip this
Some advertiser integrations require the CRM's outbound IP to be whitelisted on the advertiser's side. Before going live, get the new server's public IP (or the egress proxy's IP, if you keep routing through one) whitelisted with every advertiser that requires it — otherwise test-lead sends will fail with 401s that have nothing to do with your own config.

### 4.9 Fetch the generated admin API key
`admin_api_keys` gets one seed row via migration with a `gen_random_uuid()` default — the value differs on every fresh install:
```sql
SELECT name, api_key FROM admin_api_keys;
```
Store it securely — it authenticates every `get-all-*`/`count-*`/`send-test-lead`/`release-ftd` admin endpoint call.

## 5. Post-Deploy Checklist

- [ ] `npm run build` completed with no TypeScript errors
- [ ] Migrations applied and schema cache reloaded
- [ ] Edge Functions redeployed for any changed function; env vars/domain updated if needed
- [ ] Health check passes for a sample of functions (`{"health_check":true}` → `{"status":"ok",...}`)
- [ ] Smoke test: log in, view leads list, submit a test lead (`send-test-lead` admin endpoint), confirm distribution runs
- [ ] Check `vps-health` / VPS status indicator in the UI shows online
- [ ] Confirm `pg_cron` jobs are active (`SELECT * FROM cron.job;`)
- [ ] Soft-delete a disposable lead/affiliate/advertiser: confirm it disappears from the UI and from `count-*`, but still appears in `get-all-*` with `deleted_at` set

## Rollback

- **Frontend**: redeploy the previous Docker image tag, or restore the previous `dist/` output and re-run `docker build`/`docker run`.
- **Database**: migrations are forward-only in this repo (see `20260722100000_revert_soft_delete.sql` for the pattern — an explicit revert migration, not edited history). To roll back a schema change, write and apply a new migration that reverses it; never edit or delete an already-applied migration file.
- **Edge Functions**: redeploy the previous version of the function from git history (`git show <commit>:supabase/functions/<fn>/index.ts`), copy it into the mounted volume, and restart `supabase-edge-functions`.
