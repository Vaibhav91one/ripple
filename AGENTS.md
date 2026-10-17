<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ripple: how to work in this repo

Ripple is a company brain on FalkorDB for the WeMakeDevs x FalkorDB Graph Hacks (Track 03). One Next.js 16 app (route handlers + `lib/`) and FalkorDB 6.0.2. Deadline Oct 18, 18:00 IST.

## Rules
- **One issue = one branch = one PR.** Branch `issue-<n>-<slug>`. PR title `<type>: <summary> (#<n>)`, body sections: Context / Description / Changes in the codebase / Changes outside the codebase / How to test / Additional information. End the body with `Closes #<n>`. No "Generated with" footer.
- **Commit identity is set in the repo config** (`Vaibhav91one` noreply). Don't change it. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **pnpm in this sandbox:** pass `--config.cache-dir=/private/tmp/claude-501/pnpm-cache` (the default cache dir is not writable; `$TMPDIR` is blocked too). Don't add dependencies unless the issue needs one; most are already installed.
- **Before opening a PR:** `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` all pass. Never use `new URL("./dir/", import.meta.url)` for data folders (Turbopack treats it as an asset import and the build fails); resolve from `process.cwd()` and list the folder in `outputFileTracingIncludes`. Don't add `export const runtime`/`dynamic` (Cache Components is on). For UI work, attach a 1440×900 screenshot to the PR: `pnpm shots --base http://localhost:<port> [--routes /a,/b]` (PNGs in `.shots/<width>/`, gitignored; exits 1 on console errors or HTTP 5xx).
- **Design system:** only the tokens in `app/globals.css` (`bg-page/surface/raised/overlay`, `text-strong/body/faint`, `border-hairline`, status `conflict/gap/covered`, accent `ripple`, each with a `-soft` variant). Never hard-code colours. Status colours have one meaning each. Dark first.
- **Motion:** `motion/react` only, through `lib/motion.ts`. Transform and opacity only. Respect reduced motion.
- **Kits:** components from Beautiful UI, Rare UI and Bencho live in `components/kit/<kit>/`, restyled to our tokens, with the kit's licence file. No Bencho Pro blocks. The copied components started as fixed-data demos: when a screen needs one, refactor it to take props (data in, callbacks out) keeping its markup, styling and motion, and keep `/styleguide/kit` working by passing the old sample data. Never rebuild a look-alike. Kit code renders `m.*` (strict LazyMotion), never `motion.*`.
- **Data:** every shape comes from `lib/schemas.ts` (Zod 4). Screens read through `lib/api.ts` (mocks until Phase 3).
- **Cypher (FalkorDB 6.0.2):** `//` comments only (`--` fails). Full-text: `CREATE FULLTEXT INDEX FOR (a:Artifact) ON (a.text)`. Vector: `CREATE VECTOR INDEX … OPTIONS {dimension:384, similarityFunction:'cosine'}`. No label OR in MATCH (`(:A|:B)`); relationship OR (`-[:A|B]->`) works. Dates are epoch ints; pass `$now`.
- **Graph migrations:** any change to graph labels or properties that existing data needs ships with a migration appended to `lib/graph/migrate.ts` (run at boot, in `getContext` and by `pnpm graph:migrate [graph]`). A fresh seed is not enough: the live graph keeps its old shape.
- **Local FalkorDB:** Apple container, `container run -d --name falkor -p 6379:6379 -p 3000:3000 falkordb/falkordb:6.0.2`.

## Permissions (share the topology, redact the details)
- Contracts, clauses, deals, findings, controls, customer ARR and the quote text behind them belong to the owning team (`lib/permissions/classify.ts`). Everyone sees the topology (teams hit, acks, gap, counts). Leadership sees counts and totals, never text.
- Redaction is server-side, in `handle()` before the schema parse, and in every agent tool (`runAgent`) and MCP tool output, so restricted text never reaches a model prompt. A new route or tool must go through them.
- `lib/permissions/permissions.test.ts` (the sentinel-leak test) is required: it fails when a GET route, agent tool or MCP tool is not listed, and when any of them leaks a seeded sentinel to a non-owner. Add new routes and tools there.
- Never wrap viewer-dependent data in `use cache` (or any shared cache): the response differs per viewer.
