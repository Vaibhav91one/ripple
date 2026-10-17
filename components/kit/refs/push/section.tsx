// Push landing and CollectUI unified search (image recreation). Rows for /styleguide/refs; one RefRow per component.
import { RefRow } from "../RefRow";
import { muscleFigures, orgFigure } from "./body";
import { MixedSearch, type SearchGroup } from "./MixedSearch";
import { mixedSearchDemoGroups } from "./search-data";
import { MixedSearchDemo } from "./mixed-search-demo";
import { PillCTA } from "./PillCTA";
import { TeamHeatMap, type HeatCard } from "./TeamHeatMap";
import { TeamHeatMapDemo } from "./team-heat-map-demo";

const pushPost = "https://x.com/UltraLinx/status/2108896708956430513";
const searchPost = "https://x.com/CollectUI/status/2111155216603131975";

const favorites: SearchGroup[] = [{
  label: "Favorites",
  rows: [
    { id: "mentions", label: "iOS Mentions", icon: "x", tone: "plain" },
    { id: "note", label: "Create Note", icon: "note-plus", tone: "red" },
    { id: "radio", label: "Capital Radio", icon: "music", tone: "red" },
    { id: "tone", label: "Change Tone to Friendly", icon: "smile", tone: "red" },
    { id: "offsite", label: "Offsite 2026", icon: "doc", tone: "plain" },
    { id: "ideas", label: "iOS Ideas", icon: "sticky", tone: "plain" },
    { id: "garden", label: "Garden", icon: "tree", tone: "plain" },
  ],
}];

const frontDelts: HeatCard = { title: "Front Delts", done: 3, of: "of 16 weekly sets", right: "3 sets to Growth zone", cells: 16, filled: "info", zoneAt: 12 };
const legal: HeatCard = { title: "Legal", done: 0, of: "of 1 briefs acked", right: "not told", cells: 1, filled: "good" };
const teamCards: Record<string, HeatCard> = {
  all: { title: "All teams", done: 3, of: "of 7 teams told", right: "3 not told", cells: 7, filled: "good", zoneAt: 4 },
  eng: { title: "Eng/Platform", done: 1, of: "of 1 briefs acked", right: "told", cells: 1, filled: "good" },
  legal,
  security: { title: "Security", done: 0, of: "of 1 briefs acked", right: "not told", cells: 1, filled: "good" },
};

export default function PushSection() {
  return (
    <>
      <RefRow n={23} name="TeamHeatMap" from="Push" post={pushPost} license="image recreation" img="56-workout.jpg" crop="50% 100%" skin="push"
        replica={
          <TeamHeatMap label="Muscle map, last 7 days" tabs={["Last 7 days", "Predict"]} tab="Last 7 days" figures={muscleFigures}
            chips={[{ id: "all", label: "All muscles" }, { id: "chest", label: "Chest" }, { id: "shoulders", label: "Shoulders" }, { id: "arms", label: "Arms" }]}
            activeChip="all" card={frontDelts} />
        }
        ripple={
          <TeamHeatMapDemo label="Teams reached by the v1 sunset" tabs={["Today", "Predict"]} tab="Today" figures={[orgFigure]}
            chips={[{ id: "all", label: "All teams" }, { id: "eng", label: "Eng" }, { id: "legal", label: "Legal" }, { id: "security", label: "Security" }]}
            cards={teamCards} />
        } />
      <RefRow n={24.1} name="PillCTA hero" from="Push" post={pushPost} license="image recreation" img="56-workout.jpg" crop="50% 10%" skin="push"
        replica={<PillCTA brand="PUSH" links={["Roadmap", "Account"]} cta="Download" headline={["Build muscle as", "fast as possible"]}
          sub="Adaptive programs, built-in progression and science that back every rep." button="Try Push for Free" caption="Available on iOS & Android" />}
        ripple={<PillCTA brand="Ripple" links={["Docs", "MCP"]} cta="Open the demo" headline={["Change one thing.", "See all of it."]}
          sub="Ripple traces a change through teams, systems and customers, and shows who was never told." button="Ask who wasn't told" caption="Works in Claude Code, Cursor and the browser" />} />
      <RefRow n={24.2} name="MixedSearch" from="CollectUI" post={searchPost} license="image recreation" img="02-unified-search.jpg" crop="40% 50%" skin="push"
        replica={<MixedSearch label="Search favorites" placeholder="Search…" hint="⌘K" groups={favorites} />}
        ripple={<MixedSearchDemo label="Search Ripple" placeholder="Search…" hint="⌘K" groups={mixedSearchDemoGroups} />} />
    </>
  );
}
