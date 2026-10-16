import type { ReactNode } from "react";
import Link from "next/link";
import { Database, SearchX, Sparkles, Timer, TriangleAlert } from "lucide-react";
import LoadingState from "@/components/kit/beautifului/loading-state";
import { Button } from "@/components/ui/button";

/** Neutral notice: status colours are reserved for conflict / gap / covered, so outages stay on surface tokens. */
function Banner({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">
      <span className="text-faint" aria-hidden>{icon}</span>
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}

export const LoadingBlock = ({ label = "Tracing the ripple" }: { label?: string }) => (
  <div className="rounded-lg border border-hairline bg-surface p-6"><LoadingState label={label} /></div>
);

export const LlmDownBanner = () => (
  <Banner icon={<Sparkles className="size-4" />}>
    <b className="font-medium text-strong">Showing cached briefs.</b> The language model is unreachable, so new briefs can&apos;t be written right now.
  </Banner>
);

export const GraphDownBanner = ({ onRetry }: { onRetry?: () => void }) => (
  <Banner
    icon={<Database className="size-4" />}
    action={<Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
  >
    <b className="font-medium text-strong">Can&apos;t reach the graph.</b> FalkorDB isn&apos;t responding.
  </Banner>
);

export function AskEmpty({ kind, question }: { kind: "nothing" | "budget"; question?: string }) {
  const Icon = kind === "nothing" ? SearchX : Timer;
  return (
    <div className="space-y-2 rounded-lg border border-hairline bg-surface p-6">
      <Icon className="size-5 text-faint" aria-hidden />
      <h3 className="font-medium text-strong">{kind === "nothing" ? "Nothing found" : "Question budget used"}</h3>
      <p className="text-body">
        {kind === "nothing"
          ? `The graph has no sourced answer${question ? ` for "${question}"` : ""}. Ripple won't guess.`
          : "You've used today's questions. The budget resets tomorrow; the ripple, changes and inbox still work."}
      </p>
    </div>
  );
}

export function ResetConfirm({ onConfirm, onCancel }: { onConfirm?: () => void; onCancel?: () => void }) {
  return (
    <div role="alertdialog" aria-labelledby="reset-title" className="max-w-md space-y-3 rounded-lg border border-hairline bg-overlay p-5">
      <TriangleAlert className="size-5 text-faint" aria-hidden />
      <h3 id="reset-title" className="font-medium text-strong">Reset the demo?</h3>
      <p className="text-body">This restores the Ledgerly graph to its starting state and clears all acknowledgements.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm}>Reset demo</Button>
      </div>
    </div>
  );
}

/** Unknown id / route: a neutral empty state, never a raw error string. */
export const NotFoundBlock = ({ title, children, href = "/overview", cta = "Back to overview" }: { title: string; children: ReactNode; href?: string; cta?: string }) => (
  <div className="grid h-full place-items-center p-8">
    <div role="status" className="max-w-md space-y-2 rounded-lg border border-hairline bg-surface p-6">
      <SearchX className="size-5 text-faint" aria-hidden />
      <h2 className="font-medium text-strong">{title}</h2>
      <p className="text-sm text-body">{children}</p>
      <Button variant="outline" size="sm" asChild><Link href={href}>{cta}</Link></Button>
    </div>
  </div>
);
