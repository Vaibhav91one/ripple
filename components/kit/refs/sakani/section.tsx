// SakaniUI CRM dashboard (MIT, ported). Rows for /styleguide/refs; one RefRow per component.
import { BookUser, Briefcase, Building, Building2, ClipboardList, Code2, Database, DollarSign, FileCheck, Gavel, HeartHandshake, History, Inbox, LayoutGrid, LifeBuoy, Network, RefreshCw, Scale, ShieldCheck } from "lucide-react";
import { RefRow } from "../RefRow";
import { SideNav } from "./side-nav";
import { StatCardRow } from "./stat-card";
import { SummaryLine } from "./summary-line";
import { UnderlineTabsDemo } from "./underline-tabs-demo";

const post = "https://x.com/samosemudiamhe/status/2111189557886517683";
const common = { from: "SakaniUI CRM dashboard", post, img: "03-crm-dashboard.jpg", skin: "sakani" } as const;
const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" })
  .format(new Date()).replace(/^(\w+) /, "$1, ");

export default function SakaniSection() {
  return (
    <div className="space-y-10">
      <RefRow {...common} n={1} name="SummaryLine" license="image recreation" crop="30% 22%"
        replica={<SummaryLine date="Thursday, 16 October" summary="6 deals close this week and 3 follow-ups are overdue." />}
        ripple={<SummaryLine date={today} summary="1 decision is rippling through 5 teams; 3 teams haven't been told." />} />
      <RefRow {...common} n={2} name="StatCard with delta pill" license="MIT port" crop="30% 45%" wide
        replica={<StatCardRow items={[
          { title: "Open pipeline", value: "$1.84M", delta: "+12.4%", trend: "up", description: "vs last month" },
          { title: "Won this month", value: "$312K", delta: "+8.1%", trend: "up", description: "24 deals closed" },
          { title: "Win rate", value: "27%", delta: "−2.3%", trend: "down", description: "vs last month" },
        ]} />}
        ripple={<StatCardRow items={[
          { title: "Teams affected", value: "5", delta: "3 not told", trend: "down", description: "of 5 teams" },
          { title: "Customers", value: "40", delta: "12 tickets", trend: "flat", description: "3 deals promise v1" },
          { title: "ARR at risk", value: "$180k", delta: "2 contracts", trend: "down", description: "guarantee v1" },
        ]} />} />
      <RefRow {...common} n={3} name="SideNav" license="MIT port" crop="10% 50%"
        replica={<SideNav brand="SakaniUI" active="home"
          items={[
            { id: "home", label: "Home", icon: LayoutGrid }, { id: "inbox", label: "Inbox", icon: Inbox, badge: "6" },
            { id: "contacts", label: "Contacts", icon: BookUser }, { id: "companies", label: "Companies", icon: Building },
            { id: "deals", label: "Deals", icon: DollarSign }, { id: "tasks", label: "Tasks", icon: FileCheck },
            { id: "reports", label: "Reports", icon: ClipboardList },
          ]}
          groupTitle="Pipelines"
          group={[
            { id: "ent", label: "Enterprise", icon: Building2, color: "text-ripple-ink" },
            { id: "mid", label: "Mid-market", icon: Briefcase, color: "text-[var(--chart-2)]" },
            { id: "par", label: "Partnerships", icon: HeartHandshake, color: "text-covered-ink" },
            { id: "ren", label: "Renewals", icon: RefreshCw, color: "text-gap-ink" },
          ]}
          recentsTitle="Recents" recents={["Acme renewal — call notes", "Q3 forecast review"]} />}
        ripple={<SideNav brand="Ripple" active="overview"
          items={[
            { id: "overview", label: "Overview", icon: LayoutGrid }, { id: "inbox", label: "Inbox", icon: Inbox, badge: "6" },
            { id: "decisions", label: "Decisions", icon: Gavel }, { id: "graph", label: "Graph", icon: Network },
            { id: "changes", label: "Changes", icon: History },
          ]}
          groupTitle="Teams"
          group={[
            { id: "eng", label: "Eng/Platform", icon: Code2, color: "text-ripple-ink" },
            { id: "support", label: "Support", icon: LifeBuoy, color: "text-covered-ink" },
            { id: "sales", label: "Sales", icon: Briefcase, color: "text-[var(--chart-2)]" },
            { id: "legal", label: "Legal", icon: Scale, color: "text-conflict-ink" },
            { id: "security", label: "Security", icon: ShieldCheck, color: "text-conflict-ink" },
            { id: "devrel", label: "DevRel", icon: HeartHandshake, color: "text-gap-ink" },
            { id: "data", label: "Data", icon: Database, color: "text-faint" },
          ]}
          recentsTitle="Recents" recents={["d-1 Sunset API v1 on Jan 31", "Brief: Legal on the v1 sunset"]} />} />
      <RefRow {...common} n={4} name="UnderlineTabs" license="MIT port" crop="30% 33%" wide
        replica={<UnderlineTabsDemo items={[{ value: "overview", label: "Overview" }, { value: "pipeline", label: "Pipeline" }, { value: "activity", label: "Activity" }, { value: "forecast", label: "Forecast" }]} searchPlaceholder="Search deals, people…" />}
        ripple={<UnderlineTabsDemo items={[{ value: "overview", label: "Overview" }, { value: "ripple", label: "Ripple" }, { value: "briefs", label: "Briefs" }, { value: "changes", label: "Changes" }]} searchPlaceholder="Search decisions, systems…" />} />
    </div>
  );
}
