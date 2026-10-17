import { SteppedBars } from "@/components/ui/stepped-bars";
import { Waterfall } from "@/components/ui/waterfall";
import { WeeklyBars } from "@/components/ui/weekly-bars";

export default function ChartsSection() {
  return (
    <div className="space-y-8">
      <Waterfall
        title="Why $180k is at risk" subtitle="Two contracts guarantee API v1 past the sunset" link="Contracts"
        axis={{ min: -10, max: 200, ticks: [0, 60, 120, 180].map((v) => ({ value: v, label: `$${v}k` })) }}
        target={{ label: "Guaranteed ARR", text: "$180k", value: 180 }}
        steps={[{ label: "Northwind Capital MSA", text: "−$120k", delta: 120 }, { label: "Halden Bank MSA", text: "−$60k", delta: 60 }]}
        actual={{ label: "Covered by a plan", text: "$0k", value: 0 }}
        note={{ lead: "The Northwind contract is two thirds of the exposure.", sub: "Clause 7.2 guarantees v1 until 2027-06-30; the sunset is Jan 31." }}
      />
      <WeeklyBars
        title="Last 12 weeks" caption="% of affected teams told"
        values={[0, 0, 0, 0, 0, 0, 0, 0, 40, 40, 40, 40]}
        min={0} max={115} target={{ value: 100, label: "Target 100%" }} lastLabel="40" xLabels={["Jul 27", "Oct 12"]}
      />
      <SteppedBars
        title="Are the affected teams told?" figure="40%" chip="40 pts"
        text="2 of 5 affected teams have acknowledged the sunset of API v1. Security, Legal and DevRel have not."
        kv={[{ label: "Decision", value: "d-1 · Sunset API v1" }, { label: "Told", value: "Support and Sales" }]}
        columns={[["24 Aug", 0], ["31 Aug", 0], ["7 Sep", 0], ["14 Sep", 0], ["21 Sep", 40], ["28 Sep", 40], ["5 Oct", 40], ["12 Oct", 40]].map(([date, v]) => ({ date: String(date), value: Number(v), label: `${v}%` }))}
        min={0} max={70} tooltip={{ at: 6, text: ["2 told", "3 not told"] }}
      />
    </div>
  );
}
