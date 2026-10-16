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
- **pnpm in this sandbox:** pass `--config.cache-dir=$TMPDIR/pnpm-cache` (the default cache dir is not writable). Don't add dependencies unless the issue needs one; most are already installed.
- **Before opening a PR:** `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass. For UI work, attach a 1440×900 screenshot (headless Chrome) to the PR.
- **Design system:** only the tokens in `app/globals.css` (`bg-page/surface/raised/overlay`, `text-strong/body/faint`, `border-hairline`, status `conflict/gap/covered`, accent `ripple`, each with a `-soft` variant). Never hard-code colours. Status colours have one meaning each. Dark first.
- **Motion:** `motion/react` only, through `lib/motion.ts`. Transform and opacity only. Respect reduced motion.
- **Kits:** components from Beautiful UI, Rare UI and Bencho live in `components/kit/<kit>/`, restyled to our tokens, with the kit's licence file. No Bencho Pro blocks.
- **Data:** every shape comes from `lib/schemas.ts` (Zod 4). Screens read through `lib/api.ts` (mocks until Phase 3).
- **Cypher (FalkorDB 6.0.2):** `//` comments only (`--` fails). Full-text: `CREATE FULLTEXT INDEX FOR (a:Artifact) ON (a.text)`. Vector: `CREATE VECTOR INDEX … OPTIONS {dimension:384, similarityFunction:'cosine'}`. No label OR in MATCH (`(:A|:B)`); relationship OR (`-[:A|B]->`) works. Dates are epoch ints; pass `$now`.
- **Local FalkorDB:** Apple container, `container run -d --name falkor -p 6379:6379 -p 3000:3000 falkordb/falkordb:6.0.2`.
