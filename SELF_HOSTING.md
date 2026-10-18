# Self-hosting Ripple

Ripple runs on your own machine with one command and no accounts: web app, background worker, FalkorDB (the graph) and Postgres.

## 5-minute path

Needs Docker with Compose v2 (Docker Desktop, OrbStack, or Docker Engine) and about 3 GB of free RAM.

```bash
git clone https://github.com/Vaibhav91one/ripple.git
cd ripple/deploy/fallback
cp .env.example .env
docker compose up -d --build
```

The first build takes a few minutes. When `docker compose ps` shows `web` as `healthy`:

```bash
curl http://localhost:3000/api/health   # {"ok":true,"falkordb":"up","graph":287,"llm":"fallback"}
```

Open <http://localhost:3000>. You are in **local mode** (`RIPPLE_MODE=local`, set by `.env.example`): one writable workspace called `local`, you are its admin, and no sign-in exists or is needed. **Local mode has no login.** That is why web is published on `127.0.0.1` only; never expose it to a network or the internet. On first use it is filled with the demo data (the same company graph as the public demo), so you can open a change, approve or reject a proposed action, and see the result. Approvals and writes persist in the `falkordb-data` and `postgres-data` volumes.

For the read-only public demo instead, comment out `RIPPLE_MODE=local` in `.env` (or leave `.env` out) and run `docker compose up -d`. The demo graph is seeded at web start in both modes.

`POST /api/reset` (header `x-reset-token: $RESET_TOKEN`) deletes and re-seeds the active graph: in local mode that is `t_local`. Approvals, audit and the rest in Postgres stay.

Stop with `docker compose down`; add `-v` to also delete the data.

## What runs

| Service | What it does |
| --- | --- |
| `web` | Next.js app on port 3000. Runs database migrations on start, then serves. |
| `worker` | Same codebase, `worker` image target. Runs the queue handlers (agents, notifications, connector sync). Waits for `web` to be healthy. |
| `falkordb` | The graph database. Append-only file on a named volume. |
| `db` | Postgres 17 for approvals, memberships, audit, queue. Named volume. |
| `caddy` | Optional HTTPS in front, from `docker-compose.tls.yml`. |

## Optional: an LLM key

Without a key Ripple works: Ask answers from cached answers and `/api/health` shows `"llm":"fallback"`. To let the agent and Ask use a model, edit `.env`:

```bash
LLM_PROVIDER=openai        # anthropic | openai | google | openrouter | openai-compatible | ollama
LLM_API_KEY=sk-...
MODEL_AGENT=gpt-5.4
MODEL_EXTRACT=gpt-5.4-nano
```

Then `docker compose up -d` (it recreates `web` and `worker` with the new values). `DAILY_TOKEN_BUDGET` caps spend per day.

## Optional: HTTPS on your own domain

> **Warning: local mode has no login and the default secrets are public.** Never put a local-mode stack on a public host: anyone could approve actions and wipe the workspace. The HTTPS override below refuses to start with default secrets and always turns local mode off, so a public host serves the read-only demo, or real sign-in with Clerk keys.

Point DNS at the box, then in `.env` set `RIPPLE_DOMAIN`, `APP_URL=https://<domain>`, and real `FALKORDB_PASSWORD`, `POSTGRES_PASSWORD`, `ACK_TOKEN_SECRET`, `RESET_TOKEN` (`openssl rand -hex 32`; use letters and digits for the two passwords). Delete `RIPPLE_MODE=local`. Start:

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

Caddy fetches the certificate on first request. For sign-in, create a Clerk app and set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (inlined at **build** time, so set it before `--build`), `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SIGNING_SECRET` in `.env`; point the Clerk webhook at `<APP_URL>/api/webhooks/clerk`. `RIPPLE_AUTH=off` forces the public demo even with keys.

## Optional: GitHub and Slack

Both are optional; Ripple works without them. One-click setup: `/setup/github` (admin only: press the button, confirm on GitHub, install the app; no env vars needed) and `/setup/slack` (renders the Slack manifest for your URL). If you later set the `GITHUB_APP_*` env vars, env wins over the stored app, and the webhook accepts both secrets during the switch. To set them up by hand instead:

- **GitHub, by hand** (only if you skip `/setup/github`): create a GitHub App from `github-app-manifest.json` (details in `docs/github-app.md`), then set `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM with newlines as `\n`), `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_SLUG`, `GITHUB_REPO`. Webhook URL: `<APP_URL>/api/connectors/github/webhook`.
- **Slack**: create an app from `slack-manifest.yaml` and set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`. Request URLs are under `<APP_URL>/api/slack/` (`events`, `interactive`, `command`, `oauth`).

### Webhooks to a laptop (tunnels)

GitHub and Slack must reach your machine over the internet. Use a tunnel and set `APP_URL` to its URL:

```bash
# Option A: cloudflared (no account needed for quick tunnels)
cloudflared tunnel --url http://localhost:3000
# Option B: smee.io for GitHub webhooks only
npx smee-client --url https://smee.io/<your-channel> --target http://localhost:3000/api/connectors/github/webhook
```

For smee, use the smee channel URL as the GitHub App's webhook URL. Restart with the new `APP_URL`: `docker compose up -d`.

**Slack Socket Mode**: Socket Mode would avoid the tunnel for Slack, but Ripple's Slack integration uses HTTP request URLs (`socket_mode_enabled: false` in `slack-manifest.yaml`), so a tunnel is required for Slack today, including for `@Ripple` mentions and DMs. Start the tunnel, set `APP_URL` to it, restart, then open `/setup/slack`: it renders the manifest with your tunnel URL ready to paste into "Create app from a manifest". In channels Ripple answers with the redacted no-team viewer (everyone in the channel can read the reply); the answer uses your own team access only in a direct message with the bot. Existing Slack installs must be reinstalled to pick up the new scopes.

## Troubleshooting

- **`web` stays unhealthy**: `docker compose logs web`. Usual causes: FalkorDB or Postgres not up yet (wait, it retries), or port 3000 taken (set `WEB_PORT=3100` in `.env`).
- **Build killed or out of memory**: give Docker at least 4 GB (Settings > Resources); the Next.js build is the heavy step.
- **Changed `POSTGRES_PASSWORD` or `FALKORDB_PASSWORD` after first start**: the volumes keep the old password. Reset with `docker compose down -v` (deletes data) or change the password inside the databases.
- **Page says read-only / approvals return 403**: `RIPPLE_MODE=local` is missing from `.env` (e.g. you did not copy `.env.example`), or Clerk keys are set (Clerk takes over; leave them unset for local mode).
- **`/api/health` returns `falkordb: down`**: `docker compose logs falkordb`; the password in `.env` must match what the volume was created with.
- **Reseed the demo data**: `curl -X POST localhost:3000/api/reset -H "x-reset-token: $RESET_TOKEN"` (in local mode this wipes and re-seeds `t_local`; Postgres data stays), or `docker compose down -v` to delete everything.
- **Use the MCP server**: `claude mcp add --transport http ripple http://localhost:3000/api/mcp`.
