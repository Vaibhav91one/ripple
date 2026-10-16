// Every kit component (#3), restyled to Ripple tokens, with Ripple-flavoured sample content.
import type { ReactNode } from "react";
import { Activity, FileText, GitBranch, Users } from "lucide-react";
import ChatComposer from "@/components/kit/beautifului/chat";
import PromptBar from "@/components/kit/beautifului/prompt-bar";
import ThinkingState from "@/components/kit/beautifului/thinking";
import ToolChips from "@/components/kit/beautifului/tool-chips";
import StreamingText from "@/components/kit/beautifului/streaming-text";
import TaskRows from "@/components/kit/beautifului/task-rows";
import DiffTable from "@/components/kit/beautifului/diff-table";
import RecordsTable from "@/components/kit/beautifului/records-table";
import FilterTable from "@/components/kit/beautifului/filter-table";
import ApprovalCard from "@/components/kit/beautifului/approval-card";
import ContextCards from "@/components/kit/beautifului/context-cards";
import InsightCards from "@/components/kit/beautifului/insight-cards";
import SidebarNav from "@/components/kit/beautifului/sidebar-nav";
import SearchList from "@/components/kit/beautifului/search";
import CodeBlock from "@/components/kit/beautifului/code-block";
import LoadingState from "@/components/kit/beautifului/loading-state";
import { TaskList } from "@/components/kit/rareui/task-list";
import { NotificationBell } from "@/components/kit/rareui/notification-bell";
import { AnimatedCounter } from "@/components/kit/rareui/animated-counter";
import { AiStatus } from "@/components/kit/rareui/ai-status";
import { DeleteButton } from "@/components/kit/rareui/delete-button";
import { OtpInput } from "@/components/kit/rareui/otp-input";
import ProximitySidebar from "@/components/kit/rareui/proximity-sidebar";
import { SlideConfirm } from "@/components/kit/bencho/slide-confirm";
import { ToastStack } from "@/components/kit/bencho/toast-stack";
import { Scrub } from "@/components/kit/bencho/time-scrubber";
import { MagneticSelectDemo } from "@/components/kit/bencho/magnetic-select/demo";
import { KpiCard } from "@/components/kit/obsidian/analytics/kpi-card";
import { Sparkline } from "@/components/kit/obsidian/analytics/sparkline";
import { ActivityChart } from "@/components/kit/obsidian/analytics/activity-chart";
import { Leaderboard } from "@/components/kit/obsidian/analytics/leaderboard";
import { RepoCard } from "@/components/kit/obsidian/analytics/repo-card";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import { Digits } from "@/components/kit/obsidian/analytics/number-animation";
import { Avatar } from "@/components/kit/obsidian/analytics/avatar";
import { StatusBars } from "@/components/kit/obsidian/analytics/status-bars";
import { SegmentedDemo } from "@/components/kit/obsidian/analytics/segmented-demo";

const Kit = ({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) => (
  <section id={id} className="space-y-5">
    <header className="space-y-1 border-b border-hairline pb-3">
      <h2 className="text-lg">{title}</h2>
      <p className="text-faint">{note}</p>
    </header>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{children}</div>
  </section>
);

const Demo = ({ name, wide, children }: { name: string; wide?: boolean; children: ReactNode }) => (
  <div className={`min-w-0 space-y-2 ${wide ? "md:col-span-2" : ""}`}>
    <h3 className="text-xs text-faint">{name}</h3>
    <div className="flex min-h-24 items-start justify-start rounded-lg border border-hairline bg-surface p-5">{children}</div>
  </div>
);

const sections = [
  { id: "rareui", label: "Rare UI", kind: "title" as const },
  { id: "beautifului", label: "Beautiful UI", kind: "title" as const },
  { id: "bencho", label: "Bencho", kind: "title" as const },
  { id: "obsidian", label: "Obsidian UI", kind: "title" as const },
];

export default function KitStyleguide() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-14 p-8">
      <header className="space-y-1">
        <h1 className="text-xl">Kit components</h1>
        <p className="text-faint">Rare UI, Beautiful UI and Bencho, restyled to Ripple tokens. Sample content is Ripple-flavoured.</p>
      </header>

      <div className="fixed right-0 top-0 hidden h-screen xl:block">
        <ProximitySidebar sections={sections} />
      </div>

      <Kit id="rareui" title="Rare UI" note="MIT + Commons Clause + Attribution. components/kit/rareui">
        <Demo name="Task list">
          <TaskList
            defaultTasks={[
              { id: "1", label: "Brief to Legal · sent", done: true },
              { id: "2", label: "Update clause 7.2" },
              { id: "3", label: "Notify Acme" },
            ]}
          />
        </Demo>
        <Demo name="Notification bell">
          <div className="flex items-center gap-6">
            <NotificationBell count={3} color="red" />
            <NotificationBell variant="dot" color="orange" />
            <NotificationBell count={12} color="blue" />
          </div>
        </Demo>
        <Demo name="Animated counter">
          <span className="text-2xl text-strong">
            <AnimatedCounter value={11} suffix={<span className="ml-2 text-md text-faint">people reached</span>} />
          </span>
        </Demo>
        <Demo name="AI status">
          <div className="flex flex-col gap-3">
            <AiStatus state="researching" label="Tracing RFC-14" timer />
            <AiStatus state="done" elapsed={14} />
          </div>
        </Demo>
        <Demo name="Delete button">
          <DeleteButton />
        </Demo>
        <Demo name="OTP input">
          <OtpInput length={6} defaultValue="140" />
        </Demo>
      </Kit>

      <Kit id="beautifului" title="Beautiful UI" note="MIT. components/kit/beautifului">
        <Demo name="Chat"><ChatComposer /></Demo>
        <Demo name="Prompt bar"><PromptBar /></Demo>
        <Demo name="Thinking"><ThinkingState /></Demo>
        <Demo name="Tool chips"><ToolChips /></Demo>
        <Demo name="Streaming text (source chips)"><StreamingText /></Demo>
        <Demo name="Task rows"><TaskRows /></Demo>
        <Demo name="Diff table"><DiffTable /></Demo>
        <Demo name="Approval card"><ApprovalCard /></Demo>
        <Demo name="Context cards"><ContextCards /></Demo>
        <Demo name="Insight cards"><InsightCards /></Demo>
        <Demo name="Sidebar nav"><SidebarNav /></Demo>
        <Demo name="Search"><SearchList /></Demo>
        <Demo name="Code block"><CodeBlock loop /></Demo>
        <Demo name="Loading state"><LoadingState /></Demo>
        <Demo name="Filter table" wide><FilterTable /></Demo>
        <Demo name="Records table" wide><RecordsTable /></Demo>
      </Kit>

      <Kit id="bencho" title="Bencho" note="MIT, free blocks only. components/kit/bencho. Network graph (blast-radius) is a Pro block and is skipped.">
        <Demo name="Slide to confirm"><SlideConfirm /></Demo>
        <Demo name="Toast stack"><ToastStack /></Demo>
        <Demo name="Time scrubber"><Scrub /></Demo>
        <Demo name="Magnetic select (7 teams)">
          <div className="mx-auto"><MagneticSelectDemo count={7} /></div>
        </Demo>
        <Demo name="Magnetic select (3 options)">
          <div className="mx-auto"><MagneticSelectDemo count={3} /></div>
        </Demo>
      </Kit>

      <Kit id="obsidian" title="Obsidian UI" note="MIT. components/kit/obsidian/analytics: Analytics Dashboard pieces, prop-driven, plus Status Bars.">
        <Demo name="KPI cards" wide>
          <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-4">
            <KpiCard label="Open decisions" value={3} delta={-25} good icon={<GitBranch size={16} strokeWidth={1.7} />} spark={[7, 6, 6, 5, 4, 4, 3]} />
            <KpiCard label="Not told" value={3} delta={50} good={false} icon={<Users size={16} strokeWidth={1.7} />} spark={[1, 1, 2, 2, 2, 3, 3]} sparkTone="gap" index={1} />
            <KpiCard label="Briefs sent" value={18} delta={12} icon={<FileText size={16} strokeWidth={1.7} />} spark={[9, 11, 10, 13, 14, 16, 18]} sparkTone="covered" index={2} />
            <KpiCard label="Acknowledged" value="94%" delta={4} icon={<Activity size={16} strokeWidth={1.7} />} spark={[80, 82, 85, 84, 90, 92, 94]} index={3} />
          </div>
        </Demo>
        <Demo name="Activity chart (stacked)">
          <div className="w-full">
            <ActivityChart
              bars={[
                { label: "Mon", segments: [{ key: "decision", value: 4 }, { key: "doc", value: 2 }, { key: "brief", value: 1 }] },
                { label: "Tue", segments: [{ key: "decision", value: 6 }, { key: "doc", value: 3 }, { key: "brief", value: 2 }] },
                { label: "Wed", segments: [{ key: "decision", value: 3 }, { key: "doc", value: 5 }, { key: "brief", value: 4 }] },
                { label: "Thu", segments: [{ key: "decision", value: 8 }, { key: "doc", value: 2 }, { key: "brief", value: 3 }] },
                { label: "Fri", segments: [{ key: "decision", value: 5 }, { key: "doc", value: 1 }, { key: "brief", value: 2 }] },
              ]}
              legend={[
                { key: "decision", label: "Decisions", tone: "ripple" },
                { key: "doc", label: "Docs", tone: "neutral" },
                { key: "brief", label: "Briefs", tone: "covered" },
              ]}
              unit="changes"
            />
          </div>
        </Demo>
        <Demo name="Leaderboard (who knows)">
          <div className="w-full">
            <Leaderboard
              unit="decisions"
              rows={[
                { id: "priya", name: "Priya", value: 14, meta: "Eng, Security" },
                { id: "sam", name: "Sam", value: 9, tone: "covered", meta: "Sales" },
                { id: "ana", name: "Ana", value: 5, tone: "gap", meta: "Legal" },
              ]}
            />
          </div>
        </Demo>
        <Demo name="Status bars">
          <div className="w-full">
            <StatusBars
              rows={[
                { label: "SOC 2", percent: 82, tone: "covered" },
                { label: "Vendor reviews", percent: 55, tone: "gap" },
                { label: "Access reviews", percent: 31, tone: "conflict" },
                { label: "Docs in sync", percent: 68, tone: "ripple" },
              ]}
            />
          </div>
        </Demo>
        <Demo name="Repo card">
          <div className="w-full">
            <RepoCard
              title="acme/pricing-rfc"
              meta="Annual plans move to 14 days notice; Legal and Support have not seen it."
              tag="RFC-14"
              status={{ tone: "conflict", label: "Conflict" }}
              activity={[2, 4, 3, 6, 5, 8, 4, 3, 7, 9, 6, 5, 8, 10]}
              stats={[{ icon: <Users size={13} strokeWidth={1.9} />, label: "3 not told" }, { icon: <GitBranch size={13} strokeWidth={1.9} />, label: "2 open" }]}
              updated="Updated 4m ago"
            />
          </div>
        </Demo>
        <Demo name="Segmented"><SegmentedDemo /></Demo>
        <Demo name="Status pill">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="conflict" label="Conflict" />
            <StatusPill tone="gap" label="Gap" />
            <StatusPill tone="covered" label="Covered" />
            <StatusPill tone="neutral" label="Neutral" />
            <StatusPill tone="ripple" label="Ripple" />
          </div>
        </Demo>
        <Demo name="Sparkline">
          <div className="w-40"><Sparkline points={[3, 5, 4, 8, 6, 9, 12]} /></div>
        </Demo>
        <Demo name="Number animation">
          <span className="text-2xl text-strong"><Digits value={11} /> <span className="text-md text-faint">people reached</span></span>
        </Demo>
        <Demo name="Avatar">
          <div className="flex items-center gap-3">
            <Avatar name="Priya Nair" size={40} />
            <Avatar name="Sam Ortiz" size={32} tone="covered" />
            <Avatar name="Ana Lee" size={22} tone="gap" />
          </div>
        </Demo>
      </Kit>
    </main>
  );
}
