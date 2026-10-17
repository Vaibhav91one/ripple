"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { ExternalLink } from "lucide-react";
import LoadingState from "@/components/kit/beautifului/loading-state";
import { RippleHome } from "@/components/ripple/RippleHome";
import { StatusPills } from "@/components/ripple/StatusPills";
import { useDecisionId } from "@/components/ripple/useDecisionId";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner, NotFoundBlock } from "@/components/states/States";
import { UnderlineTabs } from "@/components/kit/refs/sakani/underline-tabs";
import { getCampaign, getNames, getRipple, isGraphDown } from "@/lib/api";
import { ActivityTab, ApprovalsTab, ConflictsTab } from "./ChangeTabs";
import { CampaignTab } from "./CampaignTab";

const TABS = ["impact", "conflicts", "campaign", "approvals", "activity"] as const;
const ITEMS = [
  { value: "impact", label: "Impact" }, { value: "conflicts", label: "Conflicts" }, { value: "campaign", label: "Campaign" },
  { value: "approvals", label: "Approvals" }, { value: "activity", label: "Activity" },
];

/** /changes/[id]: one page per change. The tab lives in `?tab=`; a bare `?conflict=` opens the Conflicts tab. */
export function ChangeScreen() {
  const [id] = useDecisionId();
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS));
  const [conflict, setConflict] = useQueryState("conflict");
  const ripple = useQuery({ queryKey: ["ripple", id], queryFn: () => getRipple(id) });
  const campaign = useQuery({ queryKey: ["campaign", id], queryFn: () => getCampaign(id), retry: false });
  const names = useQuery({ queryKey: ["names"], queryFn: getNames }).data ?? {};
  const active = conflict ? "conflicts" : (tab ?? "impact"); // a conflict link wins; picking a tab clears it

  if (ripple.isPending) return <div className="grid h-full place-items-center"><LoadingState /></div>;
  if (isGraphDown(ripple.error)) return <div className="p-8"><GraphDownBanner onRetry={() => void ripple.refetch()} /></div>;
  if (ripple.error) return <NotFoundBlock title="Change not found" href="/changes" cta="All changes">There is no change with id &quot;{id}&quot;.</NotFoundBlock>;
  const data = ripple.data;
  const name = (x: string) => names[x] ?? data.nodes.find((n) => n.id === x)?.label ?? x;
  const channel = campaign.data?.channel;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        <PageHeader title={<span className="flex items-center gap-3"><span className="truncate">{data.decision.title}</span><StatusPills conflicts={data.counts.conflicts} notTold={data.counts.notTold} /></span>}>
          {channel?.url && (
            <a href={channel.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline px-3 text-sm text-strong transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-ripple">
              Open Slack channel<ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </PageHeader>
        <div className="mt-4 overflow-x-auto border-b border-hairline">
          <UnderlineTabs items={ITEMS} value={active} onChange={(v) => { void setConflict(null); void setTab(v as (typeof TABS)[number]); }} />
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${active === "impact" ? "" : "overflow-y-auto p-5"}`} role="tabpanel">
        {active === "impact" && <RippleHome />}
        {active === "conflicts" && <ConflictsTab data={data} />}
        {active === "campaign" && (campaign.data ? <CampaignTab c={campaign.data} name={name} /> : <p className="text-sm text-faint">{campaign.isPending ? "Loading campaign…" : "The campaign could not be loaded."}</p>)}
        {active === "approvals" && <ApprovalsTab changeId={id} />}
        {active === "activity" && <ActivityTab nodeIds={new Set(data.nodes.map((n) => n.id))} />}
      </div>
    </div>
  );
}
