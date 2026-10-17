// Nizam's margin overview (image recreation). Rows for /styleguide/refs; one RefRow per component.
import { RefRow } from "../RefRow";
import { BigFigure } from "./big-figure";
import { NeedsYou } from "./needs-you";
import { PatternCard } from "./pattern-card";
import { WeeklyBars } from "./weekly-bars";
import { Waterfall } from "./waterfall";

const post = "https://x.com/nizamdesign/status/2111101029597299106";
const from = "margin by @nizamdesign";
const img = "04-saas-profit.jpg";
const common = { from, post, img, license: "image recreation", skin: "nizam" } as const;

export default function MarginSection() {
  return (
    <div className="space-y-8">
      <RefRow {...common} n={5} name="BigFigure" crop="8% 25%"
        replica={
          <BigFigure
            title="Gross margin" period="Week of Sep 21 to 27" figure="34.0%"
            delta={{ value: "1.2 pts", dir: "down", tone: "bad", vs: "vs last week" }}
            text="4.0 pts under the 38.0% target. $19.3K of profit lost against target this week."
            bar={{ fill: 56, marker: 69, from: "20%", markerLabel: "Target 38%" }}
            rows={[
              { label: "Revenue", value: "$482K", chip: { text: "6.2%", dir: "up" } },
              { label: "Gross profit", value: "$164K", chip: { text: "2.5%", dir: "up" } },
              { label: "Jobs completed", value: "158" },
            ]}
          />
        }
        ripple={
          <BigFigure
            title="Teams told" period="for d-1 · Sunset API v1" figure="40%"
            delta={{ value: "3 teams", dir: "down", tone: "bad", vs: "still not told" }}
            text="2 of 5 affected teams have heard about the sunset. Security, Legal and DevRel were never told."
            bar={{ fill: 40, marker: 100, from: "0%", markerLabel: "Target 100%" }}
            rows={[
              { label: "Customers", value: "40" },
              { label: "ARR at risk", value: "$180k" },
              { label: "Contracts in conflict", value: "1" },
            ]}
          />
        }
      />
      <RefRow {...common} n={6} name="Waterfall" crop="50% 45%"
        replica={
          <Waterfall
            title="Why it is under target" subtitle="4.0 points lost against the 38% target" link="Leakage"
            axis={{ min: 33.5, max: 38.5, ticks: [34, 35, 36, 37, 38].map((v) => ({ value: v, label: `${v}%` })) }}
            target={{ label: "Target", text: "38.0%", value: 38 }}
            steps={[
              { label: "Labor overruns", text: "−1.6 pts · $7.7K", delta: 1.6 },
              { label: "Material variance", text: "−1.1 pts · $5.3K", delta: 1.1 },
              { label: "Callbacks", text: "−0.7 pts · $3.4K", delta: 0.7 },
              { label: "Discounting", text: "−0.4 pts · $1.9K", delta: 0.4 },
              { label: "Other", text: "−0.2 pts · $1.0K", delta: 0.2 },
            ]}
            actual={{ label: "Actual", text: "34.0%", value: 34 }}
            note={{ lead: "Labor and materials explain two thirds of the gap.", sub: "Both trace back to installs in Dallas." }}
          />
        }
        ripple={
          <Waterfall
            title="Why $180k is at risk" subtitle="Two contracts guarantee API v1 past the sunset" link="Contracts"
            axis={{ min: -10, max: 200, ticks: [0, 60, 120, 180].map((v) => ({ value: v, label: `$${v}k` })) }}
            target={{ label: "Guaranteed ARR", text: "$180k", value: 180 }}
            steps={[
              { label: "Northwind Capital MSA", text: "−$120k", delta: 120 },
              { label: "Halden Bank MSA", text: "−$60k", delta: 60 },
            ]}
            actual={{ label: "Covered by a plan", text: "$0k", value: 0 }}
            note={{ lead: "The Northwind contract is two thirds of the exposure.", sub: "Clause 7.2 guarantees v1 until 2027-06-30; the sunset is Jan 31." }}
          />
        }
      />
      <RefRow {...common} n={7} name="PatternCard" crop="95% 30%"
        replica={
          <PatternCard
            pill="Pattern found" counter="1 of 3" big="8.2 pts" bigNote="under estimate over 60 days"
            headline="Compressor replacements are losing margin"
            body="Labor runs 34% over the quote on 29 jobs, most of them Dallas installs."
            button="Review 29 jobs"
          />
        }
        ripple={
          <PatternCard
            pill="Pattern found" counter="1 of 3" big="3 hops" bigNote="from api-v1, depth 4 from d-1"
            headline="Data is 3 hops away and was never told"
            body="reporting-export, billing-sync, api-gateway, then api-v1. Nobody on Data was told about the sunset."
            button="Show the path"
          />
        }
      />
      <RefRow {...common} n={8} name="NeedsYou" crop="95% 85%"
        replica={
          <NeedsYou
            title="Needs you" sub="4 things this week"
            rows={[
              { icon: "warning", title: "6 jobs under 10% margin", sub: "#5812 Brookside is lowest at 6.1%" },
              { icon: "check", title: "2 discount requests", sub: "Waiting for your OK, up to 10%" },
              { icon: "pin", title: "Dallas is 6.9 pts under target", sub: "31.1% on $196K revenue" },
              { icon: "refresh", title: "Callbacks rose to 6.4% of jobs", sub: "Up 1.1 pts since August" },
            ]}
          />
        }
        ripple={
          <NeedsYou
            title="Needs you" sub="4 things this week"
            rows={[
              { icon: "warning", title: "Acknowledge the Legal brief", sub: "Legal was never told about the sunset" },
              { icon: "check", title: "Review the Northwind conflict", sub: "Clause 7.2 holds v1 until 2027-06-30" },
              { icon: "pin", title: "Security was not told", sub: "v1 tokens stop working at shutdown" },
              { icon: "refresh", title: "Data reached at depth 4", sub: "Via reporting-export and billing-sync" },
            ]}
          />
        }
      />
      <RefRow {...common} n={9} name="WeeklyBars" crop="10% 90%"
        replica={
          <WeeklyBars
            title="Last 12 weeks" caption="Margin by week"
            values={[36.2, 35.8, 35.4, 35.7, 35, 34.5, 34.3, 34.3, 33.8, 34.8, 35.1, 34]}
            min={30} max={43.5} target={{ value: 38, label: "Target 38%" }} lastLabel="34.0" xLabels={["Jul 6", "Sep 21"]}
          />
        }
        ripple={
          <WeeklyBars
            title="Last 12 weeks" caption="% of affected teams told"
            values={[0, 0, 0, 0, 0, 0, 0, 0, 40, 40, 40, 40]}
            min={0} max={115} target={{ value: 100, label: "Target 100%" }} lastLabel="40" xLabels={["Jul 27", "Oct 12"]}
          />
        }
      />
    </div>
  );
}
