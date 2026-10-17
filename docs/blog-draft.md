# Draft: "The missing edge is the finding: building a company brain on FalkorDB"

> Draft for the Graph Hacks best-blog-post prize. Edit it into your own voice before posting.

## The problem

Product decides to sunset API v1. Engineering knows. Support finds out from an angry ticket. Sales finds out when a renewal stalls. Legal finds out that a signed contract guarantees v1 for another year. Nobody was careless; the information just never crossed the team boundary.

Search tools answer "what do we know?". The question here is different: **"what does this change touch, and who hasn't heard?"** That's a graph question.

## The model

Ripple keeps one FalkorDB graph per company:

- `(:Decision)-[:SUNSETS]->(:System)`
- `(:System)<-[:DEPENDS_ON]-(:System)`
- tickets, deals, contracts and customers point at systems (`ABOUT`, `PROMISED`, `GUARANTEES`, `USES`)
- teams `OWNS` and `CARES_ABOUT` systems
- and the edges that matter most: `INVOLVED_IN` and `ACKED` from a team to a decision

**Telling a team is an edge, so a missing edge is the finding.** "Who wasn't told" is a team that the traversal reaches but that has no `INVOLVED_IN`/`ACKED` edge to the decision. That one choice made the hardest question the simplest query.

Every edge also carries `valid_from` / `valid_to`, so the graph can say what was true last week, replay how a ripple formed, and show what changed when the sunset date moves.

## The query

The core is a variable-length traversal:

```cypher
MATCH (d:Decision {id: $id})-[sn:SUNSETS]->(s:System)
WHERE sn.valid_to IS NULL
MATCH p = (s)<-[:DEPENDS_ON*0..2]-(x:System)
WHERE ALL(e IN relationships(p) WHERE e.valid_to IS NULL)
MATCH (c:Contract)-[r:GUARANTEES]->(x) WHERE r.valid_to IS NULL
RETURN c.id, x.id, length(p) + 2 AS hop, r.src, r.quote
```

One `UNION ALL` branch per kind of thing (systems, tickets, deals, contracts, customers, teams). Every edge carries `src` (an artifact id) and `quote` (a verbatim substring of that artifact), so every claim in the UI or the agent's answer has a source you can open.

Depth is a dial. At depth 3 the sunset hits five teams. At depth 4 the graph finds `reporting-export → billing-sync → api-gateway → api-v1`, owned by the Data team, who were never told. That's the dependency nobody on the team knew about, and it's three hops away.

## The agent

The agent never writes Cypher. It picks from fixed tools (`ripple_impact`, `who_wasnt_told`, `check_contract_conflict`, `deals_at_risk`, `who_knows`, ...), each a hand-written query, and every result returns its rows, sources, the Cypher it ran and a trace. When nothing in the graph matches, the tool says so and the agent reports that instead of guessing.

The same tools are exposed over MCP, so the brain isn't another dashboard: an engineer asks Claude Code "we're removing API v1, who doesn't know?" and gets the answer where they already work. Acknowledging a brief writes an `ACKED` edge back, and the gap closes.

## What FalkorDB made easy

- Variable-length paths and `UNION ALL` for one query per question.
- `NOT` patterns for absence: the gap query.
- Full-text and vector indexes on the same `Artifact` nodes, so search lands directly in the graph.
- `MERGE` to write conflicts, acks and tasks back, so the graph updates itself.
- Gotchas: in 6.0.2, `//` comments work and `--` don't; pin the Docker tag (latest isn't 6.x); variable-length bounds can't be parameters, so validate an integer and substitute it.

## Honest limits

The data is synthetic, there are no live connectors yet, and there's no auth. Next: a GitHub check that comments on PRs touching a system with an open decision, a Slack app for briefs, and real connectors.

## Links

- Live: https://ripple.vaibhav.quest
- Code and every Cypher query: https://github.com/Vaibhav91one/ripple
- Built with Claude Code (AI-use disclosure in the README).
