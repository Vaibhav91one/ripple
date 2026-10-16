// Every kit component (#3), restyled to Ripple tokens, with Ripple-flavoured sample content.
import type { ReactNode } from "react";
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
      </Kit>
    </main>
  );
}
