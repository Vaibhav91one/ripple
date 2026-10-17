import { useQuery } from "@tanstack/react-query";
import type { Tone } from "@/components/ui/tone";
import { getNames } from "@/lib/api";
import { proposalTitle } from "@/lib/approvals/title";
import type { Subject } from "@/lib/schemas";

/** `name(id)` and `title(proposal)` resolved through /api/names; raw ids show only until it loads (or when an id is unknown). */
export function useNames() {
  const { data } = useQuery({ queryKey: ["names"], queryFn: getNames, staleTime: Infinity });
  const name = (id: string) => data?.[id] ?? id;
  return { name, title: (p: { summary: string; subject: Subject | null }) => proposalTitle(p, name) };
}

export const KIND_LABEL: Record<string, string> = {
  graph_merge: "Graph change", create_task: "Task", create_issue: "GitHub issue", send_slack: "Slack message",
  send_email: "Email", pr_comment: "PR comment", access_request: "Access request", draft_doc: "Document",
};
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k;

/** Status colours keep one meaning: conflict = failed, covered = done, gap = waiting on a person. */
export const STATUS_TONE: Record<string, Tone> = {
  pending: "gap", failed: "conflict", executed: "covered", approved: "ripple", rejected: "conflict", expired: "gap",
  done: "covered", running: "ripple", queued: "gap", budget: "gap",
};

export function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

export const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-hairline bg-raised px-3 text-sm text-strong outline-none hover:bg-overlay focus-visible:outline-2 focus-visible:outline-ripple disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-strong px-3 text-sm font-medium text-[var(--accent-ink)] outline-none hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ripple disabled:cursor-not-allowed disabled:opacity-50";
