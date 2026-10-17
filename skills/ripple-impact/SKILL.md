---
name: ripple-impact
description: Use when a change deprecates, sunsets or breaks something other teams depend on (API or schema breaking change, deprecation, sunset date, pricing or SLA change, removing a feature) and you need the impact before shipping. Queries the Ripple company graph over MCP for affected teams, customers, contracts and deals, finds who was never told, and drafts the PR description and per-team briefs with cited sources.
---

# ripple-impact

Needs the `ripple` MCP server (see the README: "Use Ripple from your agent"). Ripple answers from a graph; it never guesses. Every claim you write must carry an artifact id and a verbatim quote from a tool result.

## Steps

1. **Find the decision.** Call `list_decisions`, then `search` with the thing being changed (system, API, price). Pick the matching decision id. If none matches, say "no decision for X exists in the graph" and stop; do not invent one.
2. **Impact.** Call `ripple_impact` with the decision id. Then call it again with `depth: 4` and compare: teams or gaps that appear only at depth 4 are hidden dependencies, so call them out.
3. **Who wasn't told.** Call `who_wasnt_told`. Telling a team is an edge (INVOLVED_IN / ACKED), so a team with no edge is the finding. For each not-told team call `why_affected` (decision id + team id) to show the path (decision, system, contract/deal/ticket, team) with its quotes.
4. **Contracts and money.** Call `check_contract_conflict` (clauses that promise past the new date, with quotes) and `deals_at_risk` (open deals, amount, stage, the PROMISED quote). `affected_controls` is coarse, treat it as a hint.
5. **Write it up** (PR description or plan):
   - Summary of the change and the decision id.
   - Impact by team, with hop count (depth) for each.
   - Conflicts and ARR at risk, each with `artifact id` + quote.
   - Not-told teams and why they are hit.
   - Open questions, including anything only found at depth 4.
6. **Briefs.** Draft one short brief per not-told team: what changes, when, why that team is hit, what you need from them, with the same cited quotes. Show them to the user.

## Definitions (this company's meaning of the words)

- **Affected team:** owns, cares about, handles tickets for, or manages contracts on a system the decision reaches through `DEPENDS_ON` (default depth 3, check 4).
- **Told:** the team has an `INVOLVED_IN` or `ACKED` edge to the decision. Anything else, including a Slack mention you can't cite, is **not told**.
- **Stale acknowledgement:** an `ACKED` edge older than 90 days, or recorded before the decision last changed (for example the sunset date moved). Treat the team as not told and re-brief. Ripple does not flag this automatically yet, so say when you are applying it.
- **Conflict:** a contract clause that guarantees the system past the decision's date. It needs Legal, not just a brief.
- **At risk:** an open deal that `PROMISED` the system, or a customer seen using it in the last 120 days.

## Rules

- If a tool returns `found: false` (or empty rows), say "nothing in the graph connects to X". Do not fill the gap from memory.
- Never call `ack_brief` unless the user explicitly says yes for that team. It writes to the graph.
- Quote text exactly as returned. If you cannot cite it, leave the claim out.
- All other tools are read-only; call them freely.
