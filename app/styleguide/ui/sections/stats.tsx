import { BigFigure } from "@/components/ui/big-figure";
import { BigStats } from "@/components/ui/big-stats";
import { StatCardRow } from "@/components/ui/stat-card";
import { SummaryLine } from "@/components/ui/summary-line";

export default function StatsSection() {
  return (
    <div className="space-y-8">
      <SummaryLine date="Saturday, 17 October" summary="1 decision is rippling through 5 teams; 3 teams haven't been told." />
      <StatCardRow items={[
        { title: "Teams affected", value: "5", delta: "3 not told", trend: "down", description: "of 5 teams" },
        { title: "Customers", value: "40", delta: "12 tickets", trend: "flat", description: "3 deals promise v1" },
        { title: "ARR at risk", value: "$180k", delta: "2 contracts", trend: "down", description: "guarantee v1" },
      ]} />
      <BigStats groups={[{ heading: "One change, every team it touches", accent: true, stats: [{ value: "5", label: "teams" }, { value: "40", label: "customers" }, { value: "$180k", label: "ARR at risk" }] }]} />
      <BigFigure
        title="Teams told" period="for d-1 · Sunset API v1" figure="40%"
        delta={{ value: "3 teams", dir: "down", tone: "bad", vs: "still not told" }}
        text="2 of 5 affected teams have heard about the sunset. Security, Legal and DevRel were never told."
        bar={{ fill: 40, marker: 100, from: "0%", markerLabel: "Target 100%" }}
        rows={[{ label: "Customers", value: "40" }, { label: "ARR at risk", value: "$180k" }, { label: "Contracts in conflict", value: "1" }]}
      />
    </div>
  );
}
