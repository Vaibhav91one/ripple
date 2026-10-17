---
name: ripple-impact
description: Use when a change deprecates, sunsets or breaks something other teams depend on (API or schema breaking change, deprecation, sunset date, pricing or SLA change, removing a feature) and you need the impact before shipping. Queries the Ripple company graph over MCP for affected teams, customers, contracts and deals, finds who was never told, and drafts the PR description and per-team briefs with cited sources.
---

# ripple-impact

Needs the `ripple` MCP server (see the README: "Use Ripple from your agent"). Ripple answers from a graph; it never guesses. Every claim you write must carry an artifact id and a verbatim quote from a tool result.

## Steps

1. **Find the decision.** Call `list_decisions`, then `search` with the thing being changed (system, API, price). Pick the matching decision id. If none matches, say "no decision for X exists in the graph" and stop; do not invent one.
2. **Impact.** Call `ripple_impact` with the decision id. Then call it again with `depth: 4` and compare: teams or gaps that appear only at depth 4 are hidden dependencies, so call them out.
3. **Who wasn't told.** Call `who_wasnt_told`. Telling a team is an edge (INVOLVED_IN / ACKED), so a team with no edge is the finding.
4. **Contracts and money.** Call `check_contract_conflict` (clauses that promise past the new date, with quotes) and `deals_at_risk` (open deals, amount, stage, the PROMISED quote). `affected_controls` is coarse, treat it as a hint.
5. **Write it up** (PR description or plan):
   - Summary of the change and the decision id.
   - Impact by team, with hop count (depth) for each.
   - Conflicts and ARR at risk, each with `artifact id` + quote.
   - Not-told teams and why they are hit.
   - Open questions, including anything only found at depth 4.
6. **Briefs.** Draft one short brief per not-told team: what changes, when, why that team is hit, what you need from them, with the same cited quotes. Show them to the user.

## Rules

- If a tool returns `found: false` (or empty rows), say "nothing in the graph connects to X". Do not fill the gap from memory.
- Never call `ack_brief` unless the user explicitly says yes for that team. It writes to the graph.
- Quote text exactly as returned. If you cannot cite it, leave the claim out.
- All other tools are read-only; call them freely.
