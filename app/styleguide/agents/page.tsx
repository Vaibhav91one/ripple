import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { shellUser } from "@/components/shell/identity";
import { PageHeader } from "@/components/shell/PageHeader";
import { AGENT_ART } from "@/components/agents/art";
import { agents } from "@/lib/agent/registry";

export const metadata = { title: "Agent art · Ripple" };

/** All ten agent illustrations side by side, to keep the set coherent (#235). */
export default function StyleguideAgents() {
  return (
    <Suspense>
      <AppShell user={shellUser({})}>
        <PageHeader title="Agent art" subtitle="160 by 120, token colours, one soft plate, one shadow, one accent per agent." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {agents().map((a) => {
            const Art = AGENT_ART[a.name];
            return (
              <li key={a.name} className="rounded-card border border-hairline bg-surface p-3">
                {Art && <Art className="w-full" />}
                <p className="mt-3 px-1 text-md font-medium text-strong">{a.displayName}</p>
                <p className="px-1 pb-1 text-sm text-faint">{a.tagline}</p>
              </li>
            );
          })}
        </ul>
      </AppShell>
    </Suspense>
  );
}
