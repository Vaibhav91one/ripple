import { Suspense } from "react";
import { Bot, CircleAlert, CircleCheck, FileText, MapPin, Scale } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { shellUser } from "@/components/shell/identity";
import { DateRange, ExportButton, FilterPill, PageHeader, PrimaryButton } from "@/components/shell/PageHeader";
import { Card, CardHeader, Takeaway } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DotStrip, type Dot } from "@/components/ui/dot-strip";
import { EmptyState } from "@/components/ui/empty-state";
import { HatchedBar, PlanLegend } from "@/components/ui/hatched-bar";
import { DeltaChip, HeroNumber } from "@/components/ui/hero-number";
import { InsightCard } from "@/components/ui/insight-card";
import { NeedsYou } from "@/components/ui/needs-you";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { TargetBar } from "@/components/ui/target-bar";
import { Waterfall } from "@/components/ui/waterfall";

export const metadata = { title: "Styleguide v2 · Ripple" };

// Fixed sample data (Ledgerly demo), so the page is deterministic for screenshots.
const DOTS: Dot[] = [3, 4, 4, 5, 6, 8, 9, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 18, 19, 20, 21, 22, 22, 23, 24, 25, 26, 27, 27, 28].map((h, i) => ({
  id: `c${i}`, value: h, label: `${h} h to tell`, tone: h > 24 ? "conflict" : h > 16 ? "gap" : "covered",
}));
const CASES: { id: string; title: string; owner: string; teams: string; told: number; plan: number; status: [StatusTone, string] }[] = [
  { id: "chg-12", title: "Sunset API v1", owner: "Platform", teams: "7 teams", told: 3, plan: 7, status: ["conflict", "Conflict"] },
  { id: "chg-14", title: "New EU price list", owner: "Revenue", teams: "5 teams", told: 3, plan: 5, status: ["gap", "Not told"] },
  { id: "chg-09", title: "SSO for all admins", owner: "Security", teams: "4 teams", told: 4, plan: 4, status: ["covered", "Covered"] },
  { id: "chg-15", title: "Support hours change", owner: "Support", teams: "3 teams", told: 0, plan: 3, status: ["neutral", "Draft"] },
];

const SAMPLE_CSV = `data:text/csv,${encodeURIComponent("change,told,planned\n" + CASES.map((c) => `${c.id},${c.told},${c.plan}`).join("\n"))}`;

function Section({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-faint">{name}</h2>
      {children}
    </section>
  );
}

export default function StyleguideV2() {
  return (
    <Suspense>
      <AppShell user={shellUser({})}>
        <PageHeader title="Styleguide" subtitle="v2 primitives: light, calm, one gradient per page">
          <DateRange label="Oct 12 to 18" compare="Oct 5 to 11" />
          <FilterPill label="All teams" href="/styleguide/v2?team=all" />
          <ExportButton href={SAMPLE_CSV} />
        </PageHeader>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Coverage" sub="Sunset API v1 · due Jan 31" />
            <div className="mt-5">
              <HeroNumber value="62%" delta={{ value: "14 pts", dir: "up", tone: "good", vs: "vs yesterday" }}>
                3 of 7 affected teams have not been told. $74K of the $180K ARR at risk has no owner yet.
              </HeroNumber>
            </div>
            <div className="mt-6"><TargetBar value={62} target={100} from="0%" targetLabel="Target 100%" label="Coverage 62% of target 100%" /></div>
            <dl className="mt-5 divide-y divide-hairline text-md">
              {[["Teams told", "4 of 7", { value: "2", dir: "up", tone: "good" } as const], ["Customers notified", "12 of 40", { value: "5", dir: "down", tone: "bad" } as const], ["Acks", "3 of 7", null]].map(([k, v, d]) => (
                <div key={String(k)} className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-faint">{String(k)}</dt>
                  <dd className="flex items-center gap-3 font-medium text-strong">{String(v)}{d && typeof d === "object" && <DeltaChip {...d} />}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Waterfall
            title="Why coverage is under target" subtitle="38 points short of everyone told" link="Reports" href="/reports" stepColor="var(--gap)"
            axis={{ min: 55, max: 100, ticks: [60, 70, 80, 90, 100].map((v) => ({ value: v, label: `${v}%` })) }}
            target={{ label: "Target", text: "100%" , value: 100 }}
            steps={[
              { label: "Legal not told", text: "−14 pts · $62K", delta: 14 },
              { label: "Sales not acked", text: "−10 pts · $12K", delta: 10 },
              { label: "Security not told", text: "−8 pts", delta: 8 },
              { label: "DevRel draft pending", text: "−6 pts", delta: 6 },
            ]}
            actual={{ label: "Actual", text: "62%", value: 62 }}
            note={{ lead: "Legal and Sales explain two thirds of the gap.", sub: "Both trace back to the Northwind MSA." }}
          />
          <div className="flex flex-col gap-4">
            <InsightCard
              counter="1 of 3" figure="$62K" figureNote="ARR under a clause that blocks the sunset"
              headline="Northwind's MSA guarantees API v1 until 2027"
              body="Legal owns the contract and has not been told. Clause 7.2 conflicts with the Jan 31 date."
              action={{ label: "Open the case", href: "/reports" }}
            />
            <NeedsYou
              id="needs-you"
              rows={[
                { id: "a", icon: CircleAlert, tone: "conflict", title: "1 contract conflict", sub: "Northwind MSA clause 7.2", href: "/reports" },
                { id: "b", icon: CircleCheck, tone: "gap", title: "2 notices waiting for your OK", sub: "Drafted by the Notify agent", href: "/" },
                { id: "c", icon: MapPin, tone: "ripple", title: "Security is 2 hops away", sub: "Through the auth gateway", href: "/analytics" },
              ]}
            />
          </div>
        </div>

        <Section name="Plan vs actual (HatchedBar)">
          <Card>
            <CardHeader title="Teams told vs planned" sub="Hatched is the plan, solid is done, red tail is past the date" action={<PlanLegend plan="Planned" actual="Told" over="Late" />} />
            <ul className="mt-5 divide-y divide-hairline">
              {[["Legal", 4, 1, "1 of 4"], ["Sales", 6, 6, "On plan"], ["Support", 5, 7, "+2 late"], ["DevRel", 3, 0, "0 of 3"]].map(([team, plan, actual, note]) => (
                <li key={String(team)} className="grid grid-cols-[6rem_1fr_5rem] items-center gap-4 py-3 text-md">
                  <span className="text-strong">{team}</span>
                  <HatchedBar plan={Number(plan)} actual={Number(actual)} max={8} label={`${team}: ${actual} of ${plan}`} />
                  <span className={`text-right text-sm ${String(note).startsWith("+") ? "text-conflict-ink" : "text-faint"}`}>{note}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        <Section name="Dot strip">
          <Card>
            <CardHeader title="30 changes by time to tell" sub="One dot per change this quarter" />
            <div className="mt-6">
              <DotStrip dots={DOTS} min={0} max={32} cols={33} selected="c26" marker={{ value: 24, label: "Target 24 h" }} label="Hours from decision to every team told"
                ticks={[0, 8, 16, 24, 32].map((v) => ({ value: v, label: `${v} h` }))} />
            </div>
            <div className="mt-6"><Takeaway lead="7 changes took longer than a day to reach every team." sub="Most of them waited on Legal." /></div>
          </Card>
        </Section>

        <Section name="Data table + status pills">
          <Card>
            <CardHeader title="Least covered first" sub="4 open changes" />
            <div className="mt-4">
              <DataTable
                caption="Open changes" rows={CASES} rowKey={(r) => r.id} highlight="chg-14"
                columns={[
                  { key: "c", header: "Change", render: (r) => <><span className="block font-medium">{r.title}</span><span className="text-xs text-faint">{r.id}</span></> },
                  { key: "o", header: "Owner", render: (r) => <><span className="block">{r.owner}</span><span className="text-xs text-faint">{r.teams}</span></> },
                  { key: "t", header: "Told", align: "right", render: (r) => `${r.told} of ${r.plan}` },
                  { key: "b", header: "Coverage", className: "w-40", render: (r) => <HatchedBar plan={r.plan} actual={r.told} max={r.plan} tone="ripple" label={`${r.told} of ${r.plan}`} /> },
                  { key: "s", header: "Status", render: (r) => <StatusPill tone={r.status[0]}>{r.status[1]}</StatusPill> },
                ]}
                footer={<span>Showing 4 of 4 changes</span>}
              />
            </div>
          </Card>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill tone="conflict">Conflict</StatusPill><StatusPill tone="gap">Not told</StatusPill><StatusPill tone="covered">Covered</StatusPill><StatusPill tone="ripple">On the path</StatusPill><StatusPill tone="neutral">Draft</StatusPill>
            <DeltaChip value="1.2 pts" dir="down" tone="bad" vs="vs last week" /><DeltaChip value="6.2%" dir="up" tone="good" />
          </div>
        </Section>

        <Section name="Buttons, empty state, skeleton">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex flex-wrap gap-2"><PrimaryButton href="/reports">Approve notice</PrimaryButton><ExportButton label="Download" href={SAMPLE_CSV} /><FilterPill label="All agents" href="/agents" /></div>
              <EmptyState icon={Bot} title="No agent runs yet" action={{ label: "Ask the assistant", href: "/" }}>Runs show here once an agent drafts a notice or opens an issue.</EmptyState>
            </Card>
            <Card>
              <div className="flex items-center gap-3"><Skeleton className="size-9 rounded-full" /><div className="flex-1"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-3 w-1/3" /></div></div>
              <Skeleton className="mt-6 h-16 w-40" />
              <Skeleton className="mt-6 h-3 w-full" />
              <EmptyState icon={Scale} title="No conflicts" >Nothing in the graph contradicts this change.</EmptyState>
            </Card>
          </div>
          <div className="mt-4 rounded-card border border-dashed border-hairline p-4"><PageSkeleton /></div>
        </Section>
        <p className="mt-10 flex items-center gap-1.5 text-xs text-faint"><FileText size={12} aria-hidden /> components/ui · components/shell/PageHeader</p>
      </AppShell>
    </Suspense>
  );
}
