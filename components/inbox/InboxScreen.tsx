"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import TaskRows from "@/components/kit/beautifului/task-rows";
import { NotificationBell } from "@/components/kit/rareui/notification-bell";
import { TaskList, type Task } from "@/components/kit/rareui/task-list";
import { getInbox, isGraphDown } from "@/lib/api";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import type { InboxItem } from "@/lib/schemas";

const DAY = 86_400_000;
const fmt = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-faint">{title}</h2>
      {children}
    </section>
  );
}

export function InboxScreen() {
  const [p] = useQueryState("p", parseAsString.withDefault("p-priya"));
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["inbox", p], queryFn: () => getInbox(p) });
  const { forMe = [], sent = [] } = data ?? {};
  const [acked, setAcked] = useState<string[]>([]);
  const [now] = useState(() => Date.now());

  const briefs = forMe.filter((i): i is Extract<InboxItem, { kind: "brief" }> => i.kind === "brief");
  const tasks: Task[] = briefs.map((b) => ({ id: b.id, label: b.title, done: acked.includes(b.id) }));
  const unread = tasks.filter((t) => !t.done).length;
  const reviews = forMe.filter((i) => i.kind === "review");
  const waiting = forMe.filter((i) => i.kind === "waiting");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-8 py-8">
      {isGraphDown(error) && <GraphDownBanner onRetry={() => void refetch()} />}
      {isPending && <LoadingBlock label="Loading your inbox" />}
      <PageHeader title="For me" subtitle={`${unread} to acknowledge, ${reviews.length} to review, ${waiting.length} waiting`}>
        <NotificationBell count={unread} />
      </PageHeader>

      <Section title="Briefs to acknowledge">
        {tasks.length ? (
          <TaskList tasks={tasks} onTasksChange={(next) => setAcked(next.filter((t) => t.done).map((t) => t.id))} />
        ) : (
          <p className="text-sm text-faint">Nothing to acknowledge.</p>
        )}
      </Section>

      <Section title="Briefs you sent">
        {sent.length ? (
          <TaskRows
            rows={sent.map((s) => ({
              label: s.title,
              meta: s.status === "acked" ? "Acknowledged" : "Waiting",
              status: s.status === "acked" ? "done" : "pending",
            }))}
          />
        ) : (
          <p className="text-sm text-faint">You have not sent any briefs.</p>
        )}
      </Section>

      <Section title="Reviews assigned to you">
        {reviews.length ? (
          <TaskRows rows={reviews.map((r) => ({ label: r.title, meta: fmt(r.at), status: "active" }))} />
        ) : (
          <p className="text-sm text-faint">No reviews assigned.</p>
        )}
      </Section>

      <Section title="Who's waiting on you">
        {waiting.length ? (
          <TaskRows
            rows={waiting.map((w) => ({
              label: w.title,
              meta: `${Math.max(1, Math.floor((now - w.at * 1000) / DAY))} days`,
              status: "pending",
            }))}
          />
        ) : (
          <p className="text-sm text-faint">No one is waiting.</p>
        )}
      </Section>
    </div>
  );
}
