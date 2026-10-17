# Demo video: script and shot list (about 2 minutes)

Record on the live URL. Two windows: Claude Code (terminal, large font) with the `ripple` MCP server connected, and the browser.

Setup before recording:
```bash
claude mcp add --transport http ripple https://ripple.vaibhav.quest/api/mcp
curl -s -X POST https://ripple.vaibhav.quest/api/reset -H "x-reset-token: $RESET_TOKEN"   # clean baseline
```

| # | Time | Screen | Do | Say |
|---|---|---|---|---|
| 1 | 0:00–0:10 | Browser, `/overview` | Nothing, let it load | "Every company makes decisions that ripple across teams. The people who need to know usually find out last. Ripple is a company brain on FalkorDB that shows who a change touches, and who hasn't been told." |
| 2 | 0:10–0:35 | Claude Code | Type: *"We're removing API v1. What does that break, and who doesn't know yet?"* Let the tool calls show (`list_decisions`, `ripple_impact`, `who_wasnt_told`, `check_contract_conflict`) | "I'm an engineer in Claude Code, not in a dashboard. Claude calls Ripple's tools. Each one is a fixed Cypher query on FalkorDB; the model never writes Cypher." |
| 3 | 0:35–0:50 | Claude Code, the answer | Highlight: 40 customers, $180k ARR, Legal / Security / DevRel not told, the Northwind contract guarantees v1 past the sunset date | "40 customers, 180k of ARR, and a contract that promises v1 past the sunset. Legal was never told. Every line has a source quote." |
| 4 | 0:50–1:10 | Claude Code | Type: *"Check again at depth 4."* | "Depth 3 is the default. At depth 4 the graph walks one more dependency hop: reporting-export depends on billing-sync, which depends on the API gateway, which depends on v1. The Data team owns it, and nobody told them. That's the dependency nobody knew about." |
| 5 | 1:10–1:20 | Claude Code | Type: *"Who is affected if we sunset the fax gateway?"* | "And when something isn't in the graph, it says so instead of guessing." |
| 6 | 1:20–1:40 | Browser: `/decisions/d-1`, then `/graph?d=d-1`, then `/teams/legal` | Click the red conflict card, open a source quote; on the graph, drag the time scrubber | "The same graph drives the web app: the ripple, the source behind every claim, the graph replay over time, and a workspace per team." |
| 7 | 1:40–1:55 | Claude Code | Type: *"Acknowledge the brief for Legal."* Claude asks first; say yes. Re-run `who_wasnt_told` | "Acknowledging writes an edge back to the graph. Telling a team is an edge, so a missing edge is the finding, and now the gap closes." |
| 8 | 1:55–2:05 | Browser, README on GitHub | Scroll past the Cypher queries | "Every query is in the README. Ripple: change one thing, see everyone it touches." |

Tips: hide the bookmarks bar and notifications. If a call is slow, cut it in editing; don't speed it up. Disclose in the video description that the project was built with Claude Code (rule 11).
