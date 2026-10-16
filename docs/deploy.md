# Deploying Ripple (issue #17)

Target: Zerops, two services (`web` Next.js standalone, `falkordb` docker), domain `ripple.vaibhav.quest`.
`zerops.yaml` was written from the Zerops docs without an account, so the first push is the real test. Things marked UNCONFIRMED in that file are the first suspects if it fails.

## 1. Create the project (import yaml)

In the Zerops dashboard: **Import project** and paste:

```yaml
project:
  name: ripple
services:
  - hostname: falkordb
    type: docker@latest
    priority: 10            # created first
    verticalAutoscaling:    # ~1 GB fixed. Keys per docs.zerops.io/references/import
      minRam: 1
      maxRam: 1
      minCpu: 1
      maxCpu: 1
  - hostname: web
    type: nodejs@22
    enableSubdomainAccess: true   # temporary *.zerops.app URL for the first smoke test
    verticalAutoscaling:
      minRam: 0.5
      maxRam: 1
```

Docs gap: the docker page says CPU/RAM/disk are fixed values under `verticalAutoscaling`; the import reference lists `minRam`/`maxRam`. Equal min/max is the assumed way to pin 1 GB. If the import rejects it, set the size in the dashboard.

## 2. Secrets

Project settings, **Environment variables** (project level, secret):

| Name | Value |
|---|---|
| `FALKORDB_PASSWORD` | `openssl rand -hex 24` |
| `RESET_TOKEN` | `openssl rand -hex 24` |
| `LLM_API_KEY` | your provider key (blank = the app reports `llm: fallback`) |

Also set `LLM_PROVIDER`, `MODEL_AGENT`, `MODEL_EXTRACT` if they differ from `zerops.yaml`. If `web` cannot see the project variables by bare name, copy the three names into `web`'s `envVariables`.

## 3. Push

```bash
brew install zerops-io/tap/zcli   # or: npm i -g @zerops/zcli
zcli login <token from Zerops settings>
zcli project list                  # copy the project id
zcli push --projectId <id> --serviceId <falkordb id> --setup falkordb
zcli push --projectId <id> --serviceId <web id> --setup web
```

(`zcli push` flags are from memory of the zcli help, not checked against the docs. `zcli push --help` is authoritative.) Push `falkordb` first and wait until it is running. On boot, `web` seeds the `demo` graph if it is empty (`instrumentation.ts`); if FalkorDB is not up yet it logs and carries on, and the next `/api/reset` or restart seeds it.

## 4. Domain

1. Service `web` -> **Subdomain & domain & IP access** -> **Setup first domain access**.
2. Add `ripple.vaibhav.quest`, choose Let's Encrypt, route `/` to port 3000.
3. Get an IP: free IPv6 activates automatically; the shared IPv4 is free but not for production, a dedicated IPv4 is $3/month.
4. In Vercel DNS (vaibhav.quest): add the records Zerops shows on that page. The docs do not name the record type or target; expect a CNAME or A/AAAA to the balancer address shown in the dashboard. Add AAAA (and A if you took an IPv4) for `ripple`.

## 5. Verify

```bash
curl -s https://ripple.vaibhav.quest/api/health
# {"ok":true,"falkordb":"up","graph":109,"llm":"configured"}
curl -s -o /dev/null -w '%{http_code}\n' https://ripple.vaibhav.quest/ripple     # 200
curl -N -X POST https://ripple.vaibhav.quest/api/ask -H 'content-type: application/json' \
  -d '{"question":"who is affected if we sunset API v1?"}'   # tokens must arrive incrementally, not in one block at the end
curl -s -X POST https://ripple.vaibhav.quest/api/reset -H "x-reset-token: $RESET_TOKEN"   # {"ok":true}
```

`/api/ask` does not exist yet at the time of writing; adjust the body to the route when it lands. If the stream arrives in one lump, the Zerops balancer is buffering: see "Advanced balancer configuration" in the Zerops L7 balancer docs (the docs say nothing about streaming), or switch to the fallback.

## Fallback: VPS + docker compose + Caddy

1. Any VPS with Docker; DNS `A ripple -> <vps ip>` in Vercel DNS.
2. `git clone` the repo, `cd deploy/fallback`, create `.env` (`FALKORDB_PASSWORD`, `RESET_TOKEN`, `LLM_API_KEY`, `LLM_PROVIDER`, `MODEL_AGENT`, `MODEL_EXTRACT`).
3. `docker compose up -d --build`. Caddy gets the certificate on first request; `flush_interval -1` keeps streams unbuffered.
4. Same verify commands as above.

## What the build ships

`next.config.ts` sets `output: "standalone"` and `outputFileTracingIncludes` for `lib/graph/queries/**/*.cypher` and `lib/ingest/cache/**` (the query wrappers read them from `process.cwd()`; `server.js` chdirs to its own folder). `falkordb` is in `serverExternalPackages`; bundling it broke `next build` ("a.BigInt is not a function").
