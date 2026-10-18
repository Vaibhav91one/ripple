# Third-party notices

Ripple's own code is MIT (see `LICENSE`). The component kits below keep their own licences.

## Rare UI: `components/kit/rareui/`

Copyright (c) 2026 Swami Malode. https://rareui.com

Licensed under **MIT + Commons Clause License Condition v1.0 + Attribution**. The full text is in `components/kit/rareui/LICENSE`.
This directory is **excluded from Ripple's MIT licence**: it may not be sold, sublicensed or redistributed as components in their own right, and any project that ships it must credit Rare UI with a visible link to https://rareui.com (done in the app footer, `components/SiteCredits.tsx`, and the README).

## Beautiful UI: `components/kit/beautifului/`

Copyright (c) 2026 Shane Levine. https://www.beautifului.dev. MIT, see `components/kit/beautifului/LICENSE`.
Includes the Flowchart used by the `/graph` explorer (`flowchart.tsx`). Source copied from the public MIT mirror https://github.com/TurboKach/ai-native-react-components (Copyright (c) 2026 Turbo).

## Bencho: `components/kit/bencho/`

Copyright (c) 2026 Lorenzo Cabra. https://bencho.dev. MIT, see `components/kit/bencho/LICENSE`.
Free blocks only (Slide to confirm, Toast stack, Time scrubber, Magnetic Select, used by the team switcher). Pro blocks are not included.

## Obsidian UI: `components/kit/obsidian/`

Copyright (c) 2026 ObsidianUI. https://www.obsidianui.dev. MIT, see `components/kit/obsidian/LICENSE`.
Dashboard Shell (`dashboard-shell/`) and the analytics components (`analytics/`: KPI card, sparkline, activity chart, leaderboard, status bars and pills, segmented control and others), remapped to Ripple tokens.

## SakaniUI: `components/kit/refs/sakani/`

Copyright (c) 2026 Samuel Okpere. https://sakaniui.com. MIT, see `components/kit/refs/sakani/LICENSE`.
Stat card, sidebar, tabs and the summary line are ported from https://github.com/samzydd/Sakani-design-system and restyled to Ripple tokens.

## Design references (no code copied): `components/kit/refs/`

The other components on `/styleguide/refs` are recreated by us from public images or a written spec. No source code was copied:
Nizam (@nizamdesign: fivecorner, margin, Clearbill), Gr8r (its repo has no licence, so only its behaviour was described and rebuilt),
Proton and CollectUI. Reference screenshots stay local and are never committed.

## Brand icons: `components/brand/logos/`

Inline SVG logos for the integration connections (GitHub, Slack, Jira, Notion, VS Code, PostgreSQL, Google, Linear, HubSpot, Zendesk, Google Drive, Claude, Claude Code, Codex, Cursor, MCP). Copied at build time from the packages below; no npm package is imported at runtime.

- **devicon** (GitHub, Slack, Jira, Notion, VS Code, PostgreSQL, Google): MIT. Copyright (c) 2015 konpa and devicon contributors. https://github.com/devicons/devicon
- **Simple Icons** (Linear, HubSpot, Zendesk, Google Drive): **CC0-1.0**, public domain dedication. https://github.com/simple-icons/simple-icons. The brand logos themselves remain trademarks of their respective owners. They are used only to identify the integration, and their use here does not imply endorsement by or affiliation with those owners.
- **lobe-icons** (`@lobehub/icons-static-svg`: Claude, Claude Code, Codex, Cursor, MCP): MIT. Copyright (c) 2023 LobeHub. https://github.com/lobehub/lobe-icons. Claude, Claude Code, Codex, Cursor and MCP are trademarks of their respective owners and are used only to identify the integration.
