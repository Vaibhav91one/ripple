"use client";

// Empty-org onboarding on the Assistant home (#274): connect a tool, or load the Ledgerly sample into this org's own graph.
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { BrandIcon } from "@/components/brand/BrandIcon";
import type { Suggestion } from "@/lib/schemas";
import { starterChips } from "@/lib/assistant/smalltalk";

export type Starters = { demo: boolean; empty: boolean; sample: boolean; canManage: boolean; chips: Suggestion[] };
const DEMO: Starters = { demo: true, empty: false, sample: false, canManage: false, chips: starterChips() };

/** One source for the home chips and the chips after "hi" (#274). Until it answers (or when it fails), the demo starters. */
export function useStarters() {
  const q = useQuery({
    queryKey: ["starters"],
    queryFn: async (): Promise<Starters> => {
      const r = await fetch("/api/assistant/starters");
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    retry: false,
  });
  return { ...(q.data ?? DEMO), loaded: !q.isLoading };
}

const LINKS = [
  { href: "/connections/github", title: "Connect GitHub", sub: "Repos, owners and pull requests", icon: <BrandIcon name="github" size={18} /> },
  { href: "/connections/slack", title: "Connect Slack", sub: "Decisions and acks from your channels", icon: <BrandIcon name="slack" size={18} /> },
  { href: "/connections/csv", title: "Import a CSV", sub: "Teams, systems and customers", icon: <FileSpreadsheet size={18} aria-hidden /> },
];

export function Onboarding({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState("");
  const load = async () => {
    setState("loading");
    const r = await fetch("/api/assistant/sample", { method: "POST" }).catch(() => null);
    if (!r?.ok) { setState("error"); setMsg((await r?.json().catch(() => null))?.message ?? "The sample did not load. Try again."); return; }
    setState("idle");
    await qc.invalidateQueries(); // chips, reports and the home cards all read the graph that just changed
  };
  return (
    <section aria-labelledby="onboard-title" className="mt-8 w-full rounded-card border border-hairline bg-surface p-5 text-left">
      <h2 id="onboard-title" className="text-md font-medium text-strong">Your company brain is empty</h2>
      <p className="mt-1 text-sm text-body">Ripple learns who a change reaches from your tools. Connect one, or look around with a sample company first.</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex h-full items-start gap-3 rounded-inset border border-hairline p-3 hover:bg-raised">
              <span className="mt-0.5 text-strong">{l.icon}</span>
              <span><span className="block text-sm font-medium text-strong">{l.title}</span><span className="block text-xs text-faint">{l.sub}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        {canManage ? (
          <>
            <button type="button" onClick={() => void load()} disabled={state === "loading"} className="h-10 rounded-control bg-strong px-4 text-sm font-medium text-surface disabled:opacity-60">
              {state === "loading" ? "Loading the sample…" : "Load the sample company"}
            </button>
            <span className="text-xs text-faint">Adds Ledgerly, a made-up fintech, to this workspace only. You can remove it any time.</span>
          </>
        ) : (
          <span className="text-sm text-faint">Ask an admin of this workspace to connect a tool or load the sample company.</span>
        )}
        {state === "error" && <p role="alert" className="w-full text-sm text-conflict">{msg}</p>}
      </div>
    </section>
  );
}

/** A quiet line while the sample is in the graph, with the way out for admins. */
export function SampleNote({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    await fetch("/api/assistant/sample", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    await qc.invalidateQueries();
  };
  return (
    <p className="mt-4 text-xs text-faint">
      You are looking at the sample company, Ledgerly.{" "}
      {canManage && <button type="button" onClick={() => void remove()} disabled={busy} className="underline underline-offset-4 hover:text-body">{busy ? "Removing…" : "Remove the sample"}</button>}
    </p>
  );
}
