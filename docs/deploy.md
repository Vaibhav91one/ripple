# Deploying Ripple on Zerops

Four services: `web` (Next.js standalone), `worker` (pg-boss handlers), `falkordb` (docker) and `db` (Postgres). Live: https://web-2fa0-3000.prg1.zerops.app (the custom domain `ripple.vaibhav.quest` is pending). `zerops.yaml` is the pipeline; this page is the runbook that worked (PR #69).

## 1. Create the project

Import this yaml in the Zerops dashboard (**Import project**). `#yamlPreprocessor=on` makes Zerops generate the secrets once, at project level, so both services see them:

```yaml
#yamlPreprocessor=on
project:
  name: ripple
  envVariables:
    FALKORDB_PASSWORD: <@generateRandomString(<32>)>
    RESET_TOKEN: <@generateRandomString(<32>)>
    ACK_TOKEN_SECRET: <@generateRandomString(<32>)>
services:
  - hostname: falkordb
    type: docker@latest
    priority: 10            # created first
    verticalAutoscaling: { minRam: 1, maxRam: 1, minCpu: 1, maxCpu: 1 }
  - hostname: web
    type: nodejs@22
    enableSubdomainAccess: true
    verticalAutoscaling: { minRam: 0.5, maxRam: 1 }
```

`LLM_API_KEY` is optional. Unset, `/api/health` reports `llm: fallback` and Ask uses cached answers. Set it in the project's environment variables to enable the model.

## Postgres (`db`)

Orgs, memberships, API keys and the audit log live in Postgres (FalkorDB stays the graph). The app still boots and serves the demo with `DATABASE_URL` unset.

Add to the import yaml (the orchestrator creates the services after owner approval; they are not in the yaml above yet). `db` exists already (postgresql@17, NON_HA); `worker` is created before its first push:

```yaml
  - hostname: db
    type: postgresql@17
    mode: NON_HA
    priority: 10
  - hostname: worker
    type: nodejs@22
    zeropsSetup: worker     # picks `setup: worker` in zerops.yaml
    verticalAutoscaling: { minRam: 0.5, maxRam: 1 }
```

`worker` has no public port or subdomain. Push it like `web`: `zcli push --no-git --projectId <id> --serviceId <worker id> --setup worker`.

**Env wiring** (all in `zerops.yaml`): `web` and `worker` both get `DATABASE_URL: ${db_connectionString}`, `FALKORDB_HOST: falkordb`, `FALKORDB_PORT`, `LLM_PROVIDER`, `MODEL_AGENT`, `MODEL_EXTRACT`. Project secrets (`FALKORDB_PASSWORD`, `RESET_TOKEN`, `ACK_TOKEN_SECRET`, `LLM_API_KEY`) are visible by bare name in every service. `worker` runs `pnpm worker` (tsx, `--conditions=react-server`) and deploys `lib`, `worker`, `node_modules`, `package.json`, `tsconfig.json`; `lib/graph/queries/*.cypher` ride along inside `lib`. It does not migrate: `web` does.

**Connector secrets key**: `lib/crypto.ts` encrypts connector tokens with `RIPPLE_SECRET_KEY` when set. When unset it derives the 32-byte key with HKDF-SHA256 (ikm = `ACK_TOKEN_SECRET`, empty salt, info `ripple/connector-secrets/v1`), so a deploy needs no extra secret. The kid is the sha256 of the derived key, as with an explicit key. An explicit `RIPPLE_SECRET_KEY` always wins (use it to rotate; put the previous key in `RIPPLE_SECRET_KEY_OLD`). Rotating `ACK_TOKEN_SECRET` while relying on the derived key makes existing ciphertext undecryptable: first set `RIPPLE_SECRET_KEY_OLD` to the base64 of the old derived key, or set an explicit key first.

**Rollback** (go DB-less again): comment out `DATABASE_URL` in `web` (and `worker`) and the `initCommands` migration line in `zerops.yaml`, then redeploy `web`. The app serves the demo without Postgres. Stop `worker` (it needs the database).

Zerops exposes `${db_connectionString}`, `${db_hostname}`, `${db_port}` (5432), `${db_user}`, `${db_password}`, `${db_dbName}` (user and database are both `db`). `zerops.yaml` wires `DATABASE_URL: ${db_connectionString}` into `web`. Use the direct 5432 connection (pgBouncer on 6432 needs TLS and would break pg-boss later).

Migrations run once per deploy: `web`'s `run.initCommands` runs `zsc execOnce ${ZEROPS_appVersionId} -- node scripts/migrate.mjs`. The script and `lib/db/migrations/` are copied into the standalone folder at build. The first migration also seeds the `demo` org idempotently. Locally: `DATABASE_URL=... pnpm db:migrate`; after a schema change run `pnpm db:generate` and commit the new SQL.

## Persistence, backups, restore (#91)

`zerops.yaml` mounts the docker named volume `falkordb-data` at `/data` (a symlink to the image's data dir) and turns AOF on (`--appendonly yes --appendfsync everysec`). A host dir under `/var/lib` does not work: the start command runs as a non-root user and `mkdir` is denied (seen live on 2026-10-17). **What survives (verified live, #125)**: data persists across falkordb **restarts** (stop/start): the AOF was replayed from the `falkordb-data` volume. Data does **not** persist across **redeploys**: a redeploy moves the service to a new VM (node-id-2 became node-id-3), so the named volume does not carry over. **Never redeploy `falkordb` without taking a backup first** (see below). Before real org data goes in, move to FalkorDB Cloud or a storage option that survives redeploys, and record that decision here.

**Web recovers by itself (#125)**: the client reconnects with capped backoff, queries time out after `FALKORDB_QUERY_TIMEOUT_MS` (default 10s) and reset the client, `/api/health` answers within about 3s (`falkordb: down` when unreachable), and an emptied demo graph is re-seeded automatically (at most once a minute). No `web` restart is needed after a falkordb restart. Real org graphs are never auto-seeded, which is why the backup rule matters.

**Backups**: `scripts/backup-falkordb.sh` runs `BGSAVE`, waits for `LASTSAVE` to change, tars `dump.rdb` + the AOF dir, uploads to S3 (curl `--aws-sigv4`, path-style) and prunes to the newest `BACKUP_KEEP` (14). It has to run on the falkordb VM (the files live there) with `BACKUP_REDIS_CLI="docker exec falkordb redis-cli"`. Without `BACKUP_S3_ENDPOINT` it is a dry run that lists the archive. Env names (object-storage service `storage`): `BACKUP_S3_ENDPOINT=${storage_apiUrl}`, `BACKUP_S3_BUCKET=${storage_bucketName}`, `BACKUP_S3_ACCESS_KEY=${storage_accessKeyId}`, `BACKUP_S3_SECRET_KEY=${storage_secretAccessKey}`. The commented `envVariables` + `crontab` block in `zerops.yaml` (03:00 daily) schedules it; uncomment once `storage` exists and the script is on the VM.

**Restore** (also the scratch-restore check):

```bash
mkdir restore && cd restore
curl -fsS --aws-sigv4 "aws:amz:us-east-1:s3" --user "$KEY:$SECRET" -o b.tar.gz "$ENDPOINT/$BUCKET/falkordb-<timestamp>.tar.gz"
tar xzf b.tar.gz dump.rdb            # rdb only: with the AOF dir present, AOF would win
container run -d --name falkor-restore -p 6391:6379 -v "$PWD":/data -e REDIS_ARGS="--requirepass pw" falkordb/falkordb:6.0.2   # or docker run
redis-cli -p 6391 -a pw GRAPH.QUERY demo "MATCH (n) RETURN count(n)"   # compare with the live count
```

To restore live: stop `falkordb`, copy `dump.rdb` into the `falkordb-data` volume (`docker run --rm -v falkordb-data:/data -v $PWD:/in alpine cp /in/dump.rdb /data/`, and delete `appendonlydir`), start it. Verified locally: node count after restore matched.

**FalkorDB Cloud fallback**: if host paths do not persist, point `web` at the hosted instance by setting only `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_PASSWORD` and `FALKORDB_TLS=1`; `lib/graph/client.ts` opens a TLS socket when `FALKORDB_TLS` is on. Remove the `falkordb` service afterwards.

## 2. Gotchas that bit us (all fixed in `zerops.yaml`)

- Port protocol is lowercase `tcp`.
- `HOSTNAME` is a reserved env key, so it is set inline in `start` (`HOSTNAME=0.0.0.0 node .next/standalone/server.js`).
- pnpm is preinstalled on the Node image; do not `npm i -g` it.
- `os: ubuntu` for both build and run: `onnxruntime-node` (embeddings) needs glibc, Alpine fails.
- `onnxruntime-node/common` is in the standalone trace (`outputFileTracingIncludes` in `next.config.ts`), along with `lib/graph/queries/**/*.cypher` and `lib/ingest/cache/**`.
- `falkordb` and `@redis/client` stay in `serverExternalPackages`; bundling them breaks `next build`.

## 3. Push

```bash
zcli login <token>
zcli project list
zcli push --projectId <id> --serviceId <falkordb id> --setup falkordb
# from a clean checkout: no node_modules, no .next
zcli push --no-git --projectId <id> --serviceId <web id> --setup web
zcli service enable-subdomain --projectId <id> --serviceId <web id>
```

- Use `--no-git`: from a git worktree the `.git` file makes git mode fail with exit 128.
- Do not use `.deployignore`; it also filters `deployFiles` and removes the standalone build.
- Push `falkordb` first. On boot `web` seeds the `demo` graph if empty (`instrumentation.ts`); if FalkorDB is not up yet it logs and the next restart or `/api/reset` seeds it.

## 4. Domain

Subdomain access gives the working URL. For `ripple.vaibhav.quest`: service `web` -> **Subdomain & domain & IP access**, add the domain (Let's Encrypt, route `/` to port 3000), then add the records Zerops shows in Vercel DNS. Pending.

## 5. Verify

```bash
URL=https://web-2fa0-3000.prg1.zerops.app
curl -s $URL/api/health   # {"ok":true,"falkordb":"up","graph":287,"llm":"fallback"}
curl -s -o /dev/null -w '%{http_code}\n' $URL/overview   # 200
curl -s -X POST $URL/api/reset -H "x-reset-token: $RESET_TOKEN"   # {"ok":true}
```

MCP: `claude mcp add --transport http ripple $URL/api/mcp` (11 tools, 20 to 50 ms per call).

## Fallback: VPS + docker compose + Caddy

1. Any VPS with Docker; DNS `A ripple -> <vps ip>`.
2. `cd deploy/fallback`, create `.env` (`FALKORDB_PASSWORD`, `RESET_TOKEN`, optional `LLM_API_KEY`).
3. `docker compose up -d --build`. Caddy gets the certificate on first request; `flush_interval -1` keeps streams unbuffered.
