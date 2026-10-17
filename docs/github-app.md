# GitHub App

Ripple connects to GitHub as a GitHub App (not OAuth, not a PAT). One app, installed per org. It reads repos, CODEOWNERS and pull requests, and files issues (`create_issue`).

## What it does

| Source | Becomes |
| --- | --- |
| Each repo in the installation | `System` node `gh:<owner>/<repo>` (kind `repo`) |
| Each CODEOWNERS path other than `*` | its own `System` node `gh:<owner>/<repo>:<pattern>` (property `path`, and `section` for `[Section]` headers) |
| CODEOWNERS owners | `OWNED_BY` edge from the repo or path system to a `Team` or `Person` |
| Pull requests updated in the last 90 days (newest 50 per repo) | `PR` node `gh:<owner>/<repo>#<n>` |
| PR author / reviewers | `AUTHORED` / `REVIEWED` edges from `Person` to the PR |
| PR changed files | `ABOUT` edges from the PR to the repo and to every path system the files match |

Everything is a structured proposal (GitHub states it outright), so it is applied directly and audited as `connector.graph_write`.

### How owners are resolved

- `@org/team` -> the `Team` whose name or id matches `team` (case and punctuation ignored).
- `@login` -> the `Person` whose `github` property equals the login (case-insensitive). Set `github` on people (CSV import or by hand).
- `someone@example.com` -> the `Person` whose `email` matches.
- Anything unresolved is skipped (no stub nodes, no edge). There is no separate team mapping table yet; rename the Team or add the `github` property.

## Environment

| Var | Source |
| --- | --- |
| `GITHUB_APP_ID` | app settings page, "App ID" |
| `GITHUB_APP_PRIVATE_KEY` | the `.pem` generated on the app page, newlines written as `\n` |
| `GITHUB_APP_WEBHOOK_SECRET` | the webhook secret you set on the app |
| `GITHUB_APP_SLUG` | the app's URL name, `github.com/apps/<slug>` |
| `RIPPLE_SECRET_KEY` | already required: encrypts the stored installation id |
| `GITHUB_APP_INSTALLATION_ID`, `GITHUB_REPO` | only for the `create_issue` action (installation on the demo repo, `owner/name`) |

## Create the app (owner)

The manifest is [`github-app-manifest.json`](../github-app-manifest.json), in the format of the GitHub App manifest flow
(<https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest>). Fields used: `name`, `url`, `description`, `hook_attributes`, `redirect_url`, `callback_urls`, `setup_url`, `setup_on_update`, `public`, `default_permissions`, `default_events`.

Option A, the form (what the orchestrator does in Chrome): <https://github.com/settings/apps/new> (or `https://github.com/organizations/<org>/settings/apps/new`), and copy these values from the manifest:

- GitHub App name: `Ripple Company Brain` (names are global; add a suffix if taken)
- Homepage URL: `https://ripple.vaibhav.quest`
- Callback URL: `https://ripple.vaibhav.quest/api/connectors/github/setup`
- Setup URL: `https://ripple.vaibhav.quest/api/connectors/github/setup`, and tick "Redirect on update"
- Webhook: Active, URL `https://ripple.vaibhav.quest/api/connectors/github/webhook`, Secret = a new random string (`openssl rand -hex 32`); keep it for `GITHUB_APP_WEBHOOK_SECRET`
- Repository permissions: Contents read, Metadata read, Pull requests read and write, Checks read and write, Issues read and write
- Subscribe to events: Pull request, Push
- Where can this app be installed: Only on this account

Then "Generate a private key" (downloads the `.pem`), and note the App ID and the slug from the app URL.

Option B, the manifest flow itself: POST the manifest JSON in a `manifest` form field to `https://github.com/settings/apps/new`. GitHub redirects to `redirect_url` (`/connectors/github`) with `?code=...`; within one hour exchange it for the app id, PEM and webhook secret:

```bash
curl -X POST -H "Accept: application/vnd.github+json" https://api.github.com/app-manifests/<code>/conversions
```

`installation` and `installation_repositories` events are delivered to every GitHub App automatically and cannot be listed in `default_events`, so the manifest names only `pull_request` and `push`. The webhook route handles all four.

## Install flow

1. An admin opens `/connectors/github` and presses Connect GitHub -> `GET /api/connectors/github/install` redirects to `github.com/apps/<slug>/installations/new?state=...` (`state` is encrypted: org, user, 10 minute expiry).
2. After install GitHub redirects to the Setup URL `GET /api/connectors/github/setup?installation_id=...&state=...`. The route checks the state belongs to this admin and org, checks with the app JWT that the installation is ours, then stores a `connector_account` (`external_id` = installation id, `token_enc` = the installation id encrypted with `lib/crypto.ts`) and queues the first sync.
3. Installation tokens are never stored: `@octokit/app` mints them from the JWT and caches them in memory.

## Webhooks

One URL for every installation: `POST /api/connectors/github/webhook`.

- The `X-Hub-Signature-256` HMAC is checked with `@octokit/webhooks` against `GITHUB_APP_WEBHOOK_SECRET`. Bad or missing signature -> **401**.
- The account is found from `payload.installation.id`. An installation nobody connected is acknowledged and ignored.
- `pull_request` opened/reopened -> `pr.opened`; synchronize/edited/closed -> `pr.updated` (other actions ignored). The payload carries repo, number, title, body, author and changed paths (fetched). Deduped by `X-GitHub-Delivery` through the event log's dedupe_key.
- `push`, `installation`, `installation_repositories` -> a queued re-sync (one per account at a time).

## Sync notes

- One page per repo; the cursor is the last finished repo, and the last page clears it so the next run starts over (full re-read, upserts only).
- Limits: first 100 repos per installation, newest 50 PRs per repo, first 100 changed files and reviews per PR.
- Ownership removed from CODEOWNERS is not ended yet (`end_edge` on diff is the upgrade).

## Test

`pnpm test lib/connectors/github` runs on recorded API responses (no credentials): ownership edges from a fixture repo + CODEOWNERS into a real FalkorDB graph, the 401 on a bad signature, and `create_issue` through the octokit client against a mocked API.
