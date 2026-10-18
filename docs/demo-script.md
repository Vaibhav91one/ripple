# Demo script

Record on the live URL (https://web-2fa0-3000.prg1.zerops.app). Two windows: the browser and Claude Code (terminal, large font) with the `ripple` MCP server connected.

Setup before recording:
```bash
claude mcp add --transport http ripple https://web-2fa0-3000.prg1.zerops.app/api/mcp
curl -s -X POST https://web-2fa0-3000.prg1.zerops.app/api/reset -H "x-reset-token: $RESET_TOKEN"   # clean baseline
```

## The 60-second pitch

Every company makes decisions that ripple across teams, and the people who need to know usually find out last. Connecting an agent to Jira, Zendesk and the CRM gives it lookups, not an understanding of how a decision travels through a company. Tools are not context.

Ripple is a company brain on FalkorDB. The decision, the systems that depend on it, the customers, deals and contracts on those systems, and the teams that own them are one graph, so "what does this touch, and who hasn't heard?" is a single traversal instead of a hundred API calls. Telling a team is an edge, so a missing edge is the finding. Our demo company is sunsetting API v1: Ripple finds 40 customers and 180,000 of ARR on it, a contract that guarantees v1 past the sunset date, and Legal, Security and DevRel, who were never told. Every edge carries a source quote, every answer shows the Cypher it ran, and when nothing connects, it says so instead of guessing.

## 3-minute live demo path

| # | Time | Screen | Do | Say |
|---|---|---|---|---|
| 1 | 0:00-0:40 | Browser, `/` (Assistant) | Click the "sunset API v1" suggestion, or type: *"We're removing API v1. What does that break, and who doesn't know yet?"* Let the answer stream; open the "Cypher used" toggle | "The Assistant picks one of a fixed set of Cypher-backed tools and fills parameters. It never writes Cypher. 40 customers, 180k of ARR, and Legal, Security and DevRel were never told." |
| 2 | 0:40-1:15 | `/changes/d-1`, then `/reports/d-1` | Open the red conflict card and a source quote; show the gap list | "The case file: the ripple, the gap, and a contract that promises v1 until June 2027 when the sunset is January 31. Every line has the artifact and the verbatim quote it came from." |
| 3 | 1:15-1:45 | `/analytics` | Scroll the cards, open the embedded graph explorer, drag the time scrubber | "Same graph, different questions: leakage, forecast, and the graph itself with edges dated, so you can replay what was true when." |
| 4 | 1:45-2:10 | `/agents` | Run a read-only agent template; point at the approval preview for one that would write | "Agents run read-only against the graph. Anything that would write comes back as a preview a human approves." |
| 5 | 2:10-2:25 | `/integrations`, `/connections` | Show the copy buttons and the connected GitHub/Slack cards | "One MCP URL works in Claude Code, Desktop, Codex, Cursor and ChatGPT. Slack and GitHub bring artifacts in." |
| 6 | 2:25-3:00 | Claude Code | Type: *"Check again at depth 4."* then *"Acknowledge the brief for Legal."* (Claude asks first; say yes), then re-run `who_wasnt_told` | "In the terminal the same graph answers. Depth 4 walks one more dependency hop and finds the Data team nobody told. Acknowledging writes an ACKED edge, and the gap closes. Ripple: change one thing, see everyone it touches." |

Fallbacks: if a call is slow, cut it in editing; don't speed it up. When something is not in the graph (try *"Who is affected if we sunset the fax gateway?"*), Ripple says so; that is worth a beat if time allows.

Tips: hide the bookmarks bar and notifications. Disclose in the video description that the project was built with Claude Code (hackathon rule 11).
