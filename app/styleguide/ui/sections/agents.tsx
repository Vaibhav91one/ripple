import { AgentCard, CubeCard } from "@/components/ui/agent-card";
import { AgentCardDemo } from "@/components/ui/agent-card-demo";
import { ChangeDrawer } from "@/components/ui/change-drawer";
import { InlineAsk } from "@/components/ui/inline-ask";
import { MixedSearchDemo } from "@/components/ui/mixed-search-demo";
import { NeedsYou } from "@/components/ui/needs-you";
import { PatternCard } from "@/components/ui/pattern-card";
import { TimelineDemo } from "@/components/ui/timeline-demo";
import { TrustChecklist } from "@/components/ui/trust-checklist";
import { mixedSearchDemoGroups } from "@/components/kit/refs/push/search-data";

const trust = {
  heading: "How Ripple answers",
  items: [
    { title: "The graph decides who is affected", sub: "Teams, customers and contracts come from the edges." },
    { title: "The model only words the answer", sub: "It never picks who is told." },
    { title: "Every claim names its quote", sub: "Open the source behind each line." },
  ],
};

const timelineLabels = {
  title: "Timeline", subtitle: "Schedules, dependencies, and milestones across projects.", searchPlaceholder: "Search tasks",
  sortLabel: "Sort: Manual", groupLabel: "Group", groupOptions: ["Project"], todayLabel: "Today", weeksLabel: "Weeks", monthsLabel: "Months",
  taskHeading: "Task", milestonesLabel: "Milestones", emptyText: "Nothing on the timeline",
};

export default function AgentsSection() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2">
        <div className="pr-8"><AgentCard title="mcp · ripple" pill="5 teams" pillTone="gap" folder="ripple_impact" folderNote="d-1" progress={1} agent="Claude Code" task="who_wasnt_told" glyph=".:" status="3 teams untold" statusTone="gap" /></div>
        <div className="border-l border-hairline pl-8 pt-1"><CubeCard title="d-1 impact" price="$180k/yr" folder="40 customers" /></div>
      </div>
      <AgentCardDemo title="sandbox-ccd3d0" folder="storefront" folderNote="copied" progress={1} agent="Claude Code" task="fix the flaky checkout test" status="Working" />
      <PatternCard
        pill="Pattern found" counter="1 of 3" big="3 hops" bigNote="from api-v1, depth 4 from d-1"
        headline="Data is 3 hops away and was never told"
        body="reporting-export, billing-sync, api-gateway, then api-v1. Nobody on Data was told about the sunset."
        button="Show the path"
      />
      <NeedsYou title="Needs you" sub="4 things this week" rows={[
        { icon: "warning", title: "Acknowledge the Legal brief", sub: "Legal was never told about the sunset" },
        { icon: "check", title: "Review the Northwind conflict", sub: "Clause 7.2 holds v1 until 2027-06-30" },
        { icon: "pin", title: "Security was not told", sub: "v1 tokens stop working at shutdown" },
        { icon: "refresh", title: "Data reached at depth 4", sub: "Via reporting-export and billing-sync" },
      ]} />
      <InlineAsk heading="What would you like to check next?" before="Show me who wasn't told in" chip="/system api-v1" />
      <div className="rounded-[var(--ref-radius)] border border-hairline bg-raised p-5"><TrustChecklist {...trust} /></div>
      <ChangeDrawer
        title="Decision d-1 · Sunset API v1"
        subtitle="What was decided and who it reaches. Ripple follows the documents and the graph, nothing else."
        versionsHeading="Versions in use"
        versions={[
          { icon: "guide", name: "RFC-14", sub: "Sunset API v1 · decided Sep 22, 2026", badge: "In use" },
          { icon: "doc", name: "Sunset date", sub: "Jan 31, 2027 · 2 contracts run to Jun 30", badge: "In use" },
        ]}
        changedHeading="What changed from the plan" affected="40 customers affected"
        changes={[
          { title: "The sunset date moved to Jan 31, 2027", sub: "Northwind Capital and Halden Bank are guaranteed v1 until Jun 30.", count: 40, unit: "customers", pct: 100 },
          { title: "A depth-4 dependency was found", sub: "Data reaches api-v1 via reporting-export, billing-sync and api-gateway.", count: 1, unit: "team", pct: 20 },
          { title: "Three teams were never told", sub: "Security, Legal and DevRel have no acknowledgement.", count: 3, unit: "teams", pct: 60 },
        ]}
        rescored={{ title: "Conflict found on 6 Oct 2026", sub: "Northwind's contract guarantees v1 past the sunset date." }}
        trust={trust} closeLabel="Close" primaryLabel="See affected teams"
      />
      <MixedSearchDemo label="Search Ripple" placeholder="Search…" hint="⌘K" groups={mixedSearchDemoGroups} />
      <TimelineDemo {...timelineLabels} initialZoom="months" start="2026-09-14" days={147} today="2026-10-16"
        groups={[{
          id: "d1", name: "d-1 Sunset API v1", count: 3, tone: "ripple",
          tasks: [
            { id: "r1", title: "RFC-14 written", tone: "ripple", status: "done", who: "PR", start: "2026-09-15", end: "2026-09-22" },
            { id: "r3", title: "Eng told", tone: "covered", status: "done", who: "EN", start: "2026-09-22", end: "2026-09-23" },
            { id: "r6", title: "Security", tone: "gap", status: "todo", who: "SE", noBar: "not told", noBarAt: "2026-09-22" },
          ],
        }]}
        milestones={[{ id: "x1", date: "2026-09-22", label: "Decision made" }, { id: "x3", date: "2027-01-31", label: "API v1 sunset" }]}
        deps={[{ from: "r1", to: "r3" }]} />
    </div>
  );
}
