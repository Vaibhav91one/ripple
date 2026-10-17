"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { Boxes, FileText, Gavel, Handshake, Server, Ticket, Users, type LucideIcon } from "lucide-react";
import CodeBlock from "@/components/kit/beautifului/code-block";
import Flowchart from "@/components/kit/beautifului/flowchart";
import { Scrub } from "@/components/kit/bencho/time-scrubber";
import { fmtDate } from "@/components/panels/format";
import { useDecisionId } from "@/components/ripple/useDecisionId";
import { useTeam } from "@/components/ripple/useTeam";
import { GraphDownBanner } from "@/components/states/States";
import { isGraphDown } from "@/lib/api";
import { getGraph } from "./api";
import { GraphToolbar, useKinds, useSearch } from "./GraphToolbar";
import { inspect, toFlow } from "./model";
import { NodePanel } from "./NodePanel";

const DAY = 86_400;
const ICON: Record<string, LucideIcon> = {
  decision: Gavel, system: Server, customers: Users, tickets: Ticket, deals: Handshake, contracts: FileText, team: Boxes,
};

/** /graph: the company graph as a full-bleed flowchart. Filters, lens, selection and search live in the URL. */
export function GraphPage() {
  const [d] = useDecisionId();
  const [team] = useTeam();
  const [kinds] = useKinds();
  const [q] = useSearch();
  const [node, setNode] = useQueryState("node", parseAsString);
  const [expanded, setExpanded] = useQueryState("open", parseAsArrayOf(parseAsString).withDefault([]));
  const [day, setDay] = useState<number | null>(null);
  const [cypher, setCypher] = useQueryState("cypher", parseAsBoolean.withDefault(false));
  const [tab, setTab] = useState(0);

  const { data, error, refetch } = useQuery({
    queryKey: ["graph", d, team, kinds.join()],
    queryFn: () => getGraph(d, { team, kinds }),
    placeholderData: keepPreviousData,
  });

  const range = useMemo(() => {
    const ts = (data?.edges ?? []).map((e) => e.validFrom);
    return ts.length ? { min: Math.floor(Math.min(...ts) / DAY) * DAY, max: Math.floor(Math.max(...ts) / DAY) * DAY } : null;
  }, [data]);

  const flow = useMemo(
    () => (data ? toFlow(data, { expanded, q, at: day === null ? null : day + DAY - 1 }) : null),
    [data, expanded, q, day],
  );
  const info = data && node ? inspect(data, node, fmtDate) : null;

  if (error) {
    return (
      <div className="p-6">
        {isGraphDown(error) ? <GraphDownBanner onRetry={() => void refetch()} /> : <p className="text-sm text-conflict">Could not load the graph: {error.message}</p>}
      </div>
    );
  }
  if (!data || !flow) return <div className="h-full animate-pulse bg-page" aria-busy="true" aria-label="Loading the graph" />;

  const click = (id: string) => {
    void setNode(id);
    if (id.startsWith("c-")) {
      const next = expanded.includes(id) ? expanded.filter((y) => y !== id) : [...expanded, id];
      void setExpanded(next.length ? next : null);
    }
  };
  const nodes = flow.nodes.map((n) => {
    const Icon = ICON[n.iconKey] ?? Boxes;
    return { ...n, icon: <Icon className="size-4" /> };
  });
  const sel = data.cypher[Math.min(tab, data.cypher.length - 1)];

  return (
    <div className="relative h-full min-h-[480px] bg-page">
      <Flowchart fill direction="right" nodes={nodes} edges={flow.edges} selectedId={node} onNodeClick={click} fitKey={`${data.decision.id}|${kinds.join()}|${expanded.join()}|${info ? "panel" : ""}`} insets={{ top: 76, bottom: range ? 170 : 40, right: info ? 340 : 0 }} className="rounded-none" />
      <GraphToolbar cypher={cypher} onCypher={() => void setCypher(cypher ? null : true)} />
      <NodePanel info={info} onSelect={click} onClose={() => void setNode(null)} />

      {range && (
        <div className="absolute bottom-3 left-1/2 z-10 origin-bottom -translate-x-1/2 scale-[0.8] rounded-xl bg-surface p-2 shadow-[var(--kit-shadow-overlay)]" data-ui>
          <p className="mb-1 flex items-center justify-between px-2 text-xs text-faint">
            <span>Replay how the ripple formed</span>
            {day !== null && <button onClick={() => setDay(null)} className="text-ripple hover:underline focus-visible:outline-2 focus-visible:outline-ripple transition-colors">Latest</button>}
          </p>
          <Scrub mode="days" min={range.min} max={range.max} value={day ?? range.max} onChange={(ts) => setDay(ts >= range.max ? null : ts)} />
        </div>
      )}

      {cypher && sel && (
        <div className="absolute bottom-[150px] left-14 z-10 w-[min(560px,calc(100%-4.5rem))] space-y-2" data-ui>
          <div className="flex flex-wrap gap-1">
            {data.cypher.map((c, i) => (
              <button
                key={c.name}
                onClick={() => setTab(i)}
                aria-pressed={i === tab}
                className={`h-6 rounded-md px-2 font-mono text-xs focus-visible:outline-2 focus-visible:outline-ripple ${i === tab ? "bg-ripple-soft text-ripple" : "bg-surface text-faint hover:text-strong"} transition-colors`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <CodeBlock key={sel.name} code={sel.text} language="Cypher" title={`${sel.name}.cypher`} stream={false} className="max-w-none" />
        </div>
      )}
    </div>
  );
}
