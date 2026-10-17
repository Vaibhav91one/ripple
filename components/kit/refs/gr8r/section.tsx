// Gr8r timeline (rebuilt from spec; the source has no licence). Rows for /styleguide/refs; one RefRow per component.
import { RefRow } from "../RefRow";
import { TimelineDemo } from "./timeline-demo";
import type { TimelineGroup, TimelineMilestone, TimelineDep } from "./timeline";

const post = "https://x.com/zahragr8r/status/2110262138124320955";
const labels = {
  title: "Timeline", subtitle: "Schedules, dependencies, and milestones across projects.", searchPlaceholder: "Search tasks",
  sortLabel: "Sort: Manual", groupLabel: "Group", groupOptions: ["Project"], todayLabel: "Today", weeksLabel: "Weeks", monthsLabel: "Months",
  taskHeading: "Task", milestonesLabel: "Milestones", emptyText: "Nothing on the timeline",
};

// Replica: the tasks visible in the screenshot, Sep 14 to Oct 12 2026, today Oct 7.
const replicaGroups: TimelineGroup[] = [{
  id: "web", name: "Website Redesign", count: 18, tone: "ripple",
  tasks: [
    { id: "t1", title: "Audit existing navigation", tone: "covered", status: "done", who: "SC", start: "2026-09-20", end: "2026-09-26" },
    { id: "t2", title: "Summarize stakeholder interviews", tone: "covered", status: "done", who: "TI", start: "2026-09-24", end: "2026-09-29" },
    { id: "t3", title: "Footer and legal pages", tone: "covered", status: "done", who: "PP", start: "2026-09-28", end: "2026-10-03" },
    { id: "t4", title: "Design mobile onboarding", tone: "gap", status: "half", sub: "1/3", who: "EW", start: "2026-09-30", end: "2026-10-07", progress: 0.35 },
    { id: "t5", title: "Create homepage wireframes", tone: "ripple", status: "half", sub: "3/4", who: "SC", start: "2026-10-01", end: "2026-10-09", progress: 0.75 },
    { id: "t6", title: "Fix broken anchor links on pricing", tone: "covered", status: "done", who: "JC", start: "2026-10-03", end: "2026-10-05" },
    { id: "t7", title: "Finalize navigation", tone: "gap", status: "half", sub: "1/3", who: "JC", start: "2026-10-03", end: "2026-10-08", progress: 0.33 },
    { id: "t8", title: "Image optimization pipeline", tone: "ripple", status: "half", who: "ML", start: "2026-10-04", end: "2026-10-10", progress: 0.5 },
    { id: "t9", title: "Design responsive navigation", tone: "gap", status: "half", sub: "1/2", who: "EW", start: "2026-10-04", end: "2026-10-11", progress: 0.5 },
    { id: "t10", title: "Weekly design sync notes", tone: "muted", status: "todo", who: "TI", start: "2026-10-05", end: "2026-10-10" },
    { id: "t11", title: "Prepare design system tokens", tone: "muted", status: "todo", who: "TI", start: "2026-10-09", end: "2026-10-14" },
    { id: "t12", title: "Review responsive layouts", tone: "muted", status: "todo", who: "EW", start: "2026-10-12", end: "2026-10-17" },
    { id: "t13", title: "Build hero component", tone: "muted", status: "todo", who: "JC" },
    { id: "t14", title: "Prepare developer handoff", tone: "muted", status: "todo", who: "SC" },
    { id: "t15", title: "Write homepage copy", tone: "muted", status: "todo", who: "PP" },
  ],
}];
const replicaMs: TimelineMilestone[] = [{ id: "m1", date: "2026-10-09" }, { id: "m2", date: "2026-10-10", label: "v2 tokens" }];
const replicaDeps: TimelineDep[] = [{ from: "t5", to: "t11" }, { from: "t5", to: "t12" }, { from: "t9", to: "t12" }, { from: "t7", to: "t10" }];

// Ripple: the life of decision d-1 (dates from lib/mock/ledgerly.ts; the system chain dates are illustrative hops).
const rippleGroups: TimelineGroup[] = [
  {
    id: "d1", name: "d-1 Sunset API v1", count: 9, tone: "ripple",
    tasks: [
      { id: "r1", title: "RFC-14 written", tone: "ripple", status: "done", who: "PR", start: "2026-09-15", end: "2026-09-22" },
      { id: "r2", title: "Decision made", tone: "ripple", status: "done", who: "PR", start: "2026-09-22", end: "2026-09-23" },
      { id: "r3", title: "Eng told", tone: "covered", status: "done", who: "EN", start: "2026-09-22", end: "2026-09-23" },
      { id: "r4", title: "Support told", tone: "covered", status: "done", who: "SU", start: "2026-09-22", end: "2026-09-24" },
      { id: "r5", title: "Sales told", tone: "covered", status: "done", sub: "concern", who: "SA", start: "2026-09-22", end: "2026-09-25" },
      { id: "r6", title: "Security", tone: "gap", status: "todo", who: "SE", noBar: "not told", noBarAt: "2026-09-22" },
      { id: "r7", title: "Legal", tone: "gap", status: "todo", who: "LE", noBar: "not told", noBarAt: "2026-09-22" },
      { id: "r8", title: "DevRel", tone: "gap", status: "todo", who: "DE", noBar: "not told", noBarAt: "2026-09-22" },
      { id: "r9", title: "Data (depth 4, illustrative date)", tone: "gap", status: "half", who: "DA", start: "2026-10-12", end: "2026-10-13" },
    ],
  },
  {
    id: "chain", name: "Dependency chain (hops, not dates)", count: 4, tone: "conflict",
    tasks: [
      { id: "s1", title: "api-v1", tone: "ripple", status: "half", who: "V1", start: "2026-09-22", end: "2026-10-06" },
      { id: "s2", title: "api-gateway", tone: "ripple", status: "todo", who: "GW", start: "2026-10-06", end: "2026-10-08" },
      { id: "s3", title: "billing-sync", tone: "ripple", status: "todo", who: "BS", start: "2026-10-08", end: "2026-10-10" },
      { id: "s4", title: "reporting-export", tone: "ripple", status: "todo", who: "RE", start: "2026-10-10", end: "2026-10-12" },
    ],
  },
];
const rippleMs: TimelineMilestone[] = [
  { id: "x1", date: "2026-09-22", label: "Decision made" },
  { id: "x2", date: "2026-10-06", label: "Conflict detected" },
  { id: "x3", date: "2027-01-31", label: "API v1 sunset" },
];
const rippleDeps: TimelineDep[] = [{ from: "s1", to: "s2" }, { from: "s2", to: "s3" }, { from: "s3", to: "s4" }, { from: "r2", to: "r3" }];

export default function Gr8rSection() {
  return (
    <RefRow n={20} name="Timeline" from="Gr8r" post={post} license="spec rebuild" img="36-gr8r-tasks.jpg" crop="75% 45%" skin="gr8r" wide
      replica={<TimelineDemo {...labels} milestoneCount={10} initialZoom="weeks" start="2026-09-14" days={29} today="2026-10-07" groups={replicaGroups} milestones={replicaMs} deps={replicaDeps} />}
      ripple={<TimelineDemo {...labels} initialZoom="months" start="2026-09-14" days={147} today="2026-10-16" groups={rippleGroups} milestones={rippleMs} deps={rippleDeps} />} />
  );
}
