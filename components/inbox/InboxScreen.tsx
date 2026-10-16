"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import TaskRows from "@/components/kit/beautifului/task-rows";
import { NotificationBell } from "@/components/kit/rareui/notification-bell";
import { TaskList, type Task } from "@/components/kit/rareui/task-list";
import { getInbox } from "@/lib/api";
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
  const { data = [] } = useQuery({ queryKey: ["inbox", p], queryFn: () => getInbox(p) });
  const [acked, setAcked] = useState<string[]>([]);
  const [now] = useState(() => Date.now());

  const briefs = data.filter((i): i is Extract<InboxItem, { kind: "brief" }> => i.kind === "brief");
  const tasks: Task[] = briefs.map((b) => ({ id: b.id, label: b.title, done: acked.includes(b.id) }));
  const unread = tasks.filter((t) => !t.done).length;
  const reviews = data.filter((i) => i.kind === "review");
  const waiting = data.filter((i) => i.kind === "waiting");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-strong">For me</h1>
          <p className="text-sm text-body">
            {unread} to acknowledge, {reviews.length} to review, {waiting.length} waiting
          </p>
        </div>
        <NotificationBell count={unread} />
      </header>

      <Section title="Briefs to acknowledge">
        {tasks.length ? (
          <TaskList tasks={tasks} onTasksChange={(next) => setAcked(next.filter((t) => t.done).map((t) => t.id))} />
        ) : (
          <p className="text-sm text-faint">Nothing to acknowledge.</p>
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
    </main>
  );
}
