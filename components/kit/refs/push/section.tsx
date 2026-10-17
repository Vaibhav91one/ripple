// CollectUI unified search (image recreation). Rows for /styleguide/refs; one RefRow per component.
import { RefRow } from "../RefRow";
import { MixedSearch, type SearchGroup } from "./MixedSearch";
import { mixedSearchDemoGroups } from "./search-data";
import { MixedSearchDemo } from "./mixed-search-demo";

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

export default function PushSection() {
  return (
    <RefRow n={23} name="MixedSearch" from="CollectUI" post={searchPost} license="image recreation" img="02-unified-search.jpg" crop="40% 50%" skin="push"
      replica={<MixedSearch label="Search favorites" placeholder="Search…" hint="⌘K" groups={favorites} />}
      ripple={<MixedSearchDemo label="Search Ripple" placeholder="Search…" hint="⌘K" groups={mixedSearchDemoGroups} />} />
  );
}
