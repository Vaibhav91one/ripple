# Ripple reference

Long-form reference moved out of the README: data model, numbers, FalkorDB gotchas, eval and the MCP tool list. Every Cypher template lives in `lib/graph/queries/*.cypher`.

## Graph data model

**Nodes** (label: properties). Artifacts carry two labels, `Artifact` plus their kind.

| Label | Properties |
|---|---|
| Team | id, name |
| Person | id, name, title, email, teamId, active |
| System | id, name, kind (api/service/repo), status, version, successor |
| Customer | id, name, arr, tier, region, monthlyCalls |
| Deal | id, name, stage, amount, closeDate, customerId |
| Contract | id, name, endsAt, customerId |
| Decision | id, title, status, decidedAt |
| Incident, Task | id plus title/status/timestamps |
| Clause | id, contractId, number, title, text, risk, dueAt, v1Related |
| Framework | id, name |
| Control | id, frameworkId, name, status (passing/failing), auditBlocking, ownerId, v1Related |
| Vendor | id, name, riskTier, assessmentStatus, nextReview |
| Finding | id, title, severity, slaDueAt, systemId, status, ownerId, v1Related |
| Risk | id, title, likelihood, impact, status, ownerId, teamId, v1Related |
| Page | id, path, views30d, feedbackUp, feedbackDown, v1Related |
| DocsStats | id, failedSearchesJson, sdkAdoptionJson |
| Goal | id, title, ownerTeamId, progress, status, target, current |
| Artifact + Doc / Ticket / Message / PR | id, kind, title, text, ts, uri, author, emb (384-d vector), status (tickets); v2 adds ticket priority/SLA fields and PR repo/state/reviewer fields |
| Conflict | id, kind, severity, status, decisionId, contractIds, detectedAt, sources (JSON) |

**Edges**, grouped:

- Org: `MEMBER_OF`, `OWNS`, `CARES_ABOUT`, `MAINTAINS`, `ASSIGNED`, `CONTACT`
- Work evidence: `AUTHORED`, `REVIEWED`, `ABOUT`, `RAISED_BY`, `HANDLED_BY`, `ATTENDED`
- System graph: `DEPENDS_ON`, `USES`, `AFFECTED`, `CAUSED_BY`
- Commercial: `PROMISED`, `GUARANTEES`, `PARTY_TO`, `OWNED_BY`, `MANAGED_BY`
- Decisions: `SUNSETS`, `SUPPORTED_BY`, `SUPERSEDES`, `INVOLVED_IN`, `ACKED`, `BETWEEN`
- Process: `WAITING_ON`, `NOTIFIES`
- v2 workspaces: `HAS_CLAUSE` (Contract to Clause), `COVERS` (Control to Framework), `BLOCKED_BY` (Goal to a Decision, Finding or Task), `FOUND_IN` (Finding to System), `REQUESTED_REVIEW` (reviewer to PR)

**Rules**

- Every edge has `valid_from`, `valid_to` (absent/null = current) and `observed_at`. Ended edges are kept, not deleted.
- Extracted edges carry `src` (artifact id) and `quote`. A quote must be a verbatim substring of the artifact text; edges that fail the check are dropped (`quoteCheck` in `lib/ingest/extract.ts`).
- ACL fields: artifacts record `author`, and the ack link is a signed token scoped to one team and one decision. Graphs are separated per company key.
- All dates are epoch-second integers (`$now` is passed in), so no date arithmetic is needed in Cypher.


## Numbers

Local graph `demo`, measured with `GRAPH.RO_QUERY`: 284 nodes, 462 edges across 27 edge types (the live server reports 287 nodes).

| Node label | Count | | Edge type | Count |
|---|---|---|---|---|
| Artifact | 89 | | USES | 42 |
| Customer | 41 | | ABOUT | 69 |
| Person | 31 | | HANDLED_BY, RAISED_BY | 37 each |
| Deal | 16 | | OWNS | 36 |
| Control | 14 | | AUTHORED | 32 |
| Clause | 13 | | MEMBER_OF | 31 |
| Team | 10 | | PARTY_TO | 24 |
| System | 9 | | REVIEWED | 20 |
| Contract, Task, Page | 8 each | | ASSIGNED, OWNED_BY | 16 each |
| Goal | 7 | | ACKED | 15 |
| Vendor, Risk, Incident, Finding | 6 each | | COVERS, HAS_CLAUSE, MANAGED_BY, AFFECTED, others | 87 (15 types) |
| Decision, Framework | 2 each | | | |
| Conflict, DocsStats | 1 each | | | |

Live MCP latency: 20 to 50 ms per tool call. Eval: 16/16 (see Eval).

## FalkorDB gotchas we hit

- **`--` comments fail.** Use `//`.
- **Old full-text procedure.** Create the index with `CREATE FULLTEXT INDEX FOR (a:Artifact) ON (a.text)`, query with `db.idx.fulltext.queryNodes`.
- **Vector index** needs `OPTIONS {dimension:384, similarityFunction:'cosine'}`. The returned `score` is a distance, so `ORDER BY score` ascending.
- **No label OR in `MATCH`** (`(:A|:B)` fails), but relationship OR (`-[:A|B]->`) works. That is why artifacts get a shared `Artifact` label.
- **No date arithmetic**: store epoch ints and pass `$now`; `r.last_seen >= $now - 120 * 86400` works on ints.
- **Aggregates**: a `count()` next to non-aggregated columns groups by them, so `gap.cypher` uses `count(i) > 0` after `OPTIONAL MATCH`; collecting maps works (`collect({artifactId: g.src, ...})`), and `head(collect(x))` picks one value per group. `ripple.cypher` avoids one big aggregate: it is `UNION ALL` branches with a single row shape, and the wrapper groups and dedupes in TypeScript.
- **Bundling the client breaks the Next build** (`a.BigInt is not a function`): list `falkordb` and `@redis/client` in `serverExternalPackages`.

## Eval

`pnpm eval` runs 16 questions about Ledgerly against the `demo` graph using the deterministic query wrappers (no LLM). Each question names its tool and expected source artifact ids; a row passes only if the answer matches and every expected source id is returned. `lib/eval/eval.test.ts` runs the same harness on a throwaway `test_v_<uuid>` graph.

| # | Question | Answer | Tool | Sources ok | Pass |
|---|---|---|---|---|---|
| 1 | Who knows the v1 auth flow best? | p-priya | who-knows (api-v1) | yes | PASS |
| 2 | Who has handled the most v1 tickets? | p-ana | who-knows (api-v1) | yes | PASS |
| 3 | Who reviewed Priya's v1 pull requests? | p-sam | who-knows (api-v1) | yes | PASS |
| 4 | Which contracts still promise v1 past the sunset? | ctr-1, ctr-2 | conflicts-detect | yes | PASS |
| 5 | Which document set the Jan 31 sunset date? | art-rfc14 | conflicts-detect | yes | PASS |
| 6 | What is the gap for the v1 sunset (teams hit but never told)? | devrel, legal, security | gap | yes | PASS |
| 7 | Which teams does the v1 sunset ripple into? | devrel, legal, sales, security, support | ripple | yes | PASS |
| 8 | How much ARR is at risk from the open conflict? | 180000 | ripple + conflicts-detect | yes | PASS |
| 9 | How many open conflicts does the sunset have? | 1 | conflicts-list | yes | PASS |
| 10 | How many open tickets are about v1? | 12 | ripple | yes | PASS |
| 11 | How many open deals promised v1? | 3 | ripple | yes | PASS |
| 12 | Why is Security in the ripple? | owns auth-service, which depends on API v1 | ripple | yes | PASS |
| 13 | Which team blocks the most open requests? | legal | bottleneck | yes | PASS |
| 14 | Who is waiting on Legal? | eng, finance, product, sales | bottleneck | yes | PASS |
| 15 | Which artifact mentions Northwind (full-text)? | art-msa-northwind | search | yes | PASS |
| 16 | Who is affected if we sunset the fax-gateway service? | not in graph | who_knows (fax-gateway) | yes | PASS |

16/16 passed


## MCP tools

Tools (all read-only except `ack_brief`; each returns JSON `{ rows, sources, cypher, trace }`):

- `list_decisions`: every decision id, title and status.
- `search`: full-text search over documents, tickets, messages and PRs.
- `ripple_impact`: teams, customers, ARR and conflicts a decision touches (optional `depth`).
- `who_knows`: top people for a system, with evidence.
- `trace_decision`: a decision and the artifacts that support it.
- `bottleneck`: teams blocking the most open requests.
- `why_affected`: the shortest evidence path from a decision to one team (decision, system, contract/deal/ticket, team) with source quotes.
- `who_wasnt_told`: affected teams that never saw the decision, and why.
- `check_contract_conflict`: contract conflicts with severity and verbatim clause quotes.
- `deals_at_risk`: open deals in the ripple with amount, stage and the PROMISED quote.
- `affected_controls`: security controls tied to the decision (coarse: v1-related controls, there is no Control-to-System edge).
- `critical_systems`, `team_clusters`, `weighted_path`: graph-algorithm tools (centrality, communities, cheapest dependency route by `weight`).
- `list_agents`, `run_agent`: list the agent templates and run one read-only (a write returns previews).
- `ack_brief`: record a team's acknowledgement (writes to the demo graph).

