// Nizam's fivecorner rule-set drawer (image recreation). Rows for /styleguide/refs; one RefRow per component.
import { RefRow } from "../RefRow";
import { ChangeDrawer } from "./change-drawer";
import { InlineAsk } from "./inline-ask";
import { SteppedBars } from "./stepped-bars";
import { TrustChecklist } from "./trust-checklist";

const from = "fivecorner by @nizamdesign";
const post = "https://x.com/nizamdesign/status/2111200760880923119";
const img = "00-drawer.jpg";
const common = { from, post, img, license: "image recreation", skin: "nizam" } as const;

const fcTrust = {
  heading: "How Fivecorner uses rules",
  items: [
    { title: "Rules decide pass or fail", sub: "AI only suggests fixes. It never scores an invoice." },
    { title: "Every result names its rule", sub: "You can see the field, the rule and the version behind it." },
    { title: "New rules mean a new check", sub: "When a version changes, we re-score and tell you here." },
  ],
};
const rpTrust = {
  heading: "How Ripple answers",
  items: [
    { title: "The graph decides who is affected", sub: "Teams, customers and contracts come from the edges." },
    { title: "The model only words the answer", sub: "It never picks who is told." },
    { title: "Every claim names its quote", sub: "Open the source behind each line." },
  ],
};

export default function FivecornerSection() {
  return (
    <div className="space-y-8">
      <RefRow {...common} n={10} name="ChangeDrawer" crop="90% 50%"
        replica={
          <ChangeDrawer
            title="Rule set v1.1"
            subtitle="The rules your invoices are checked against. Fivecorner follows the published documents, nothing else."
            versionsHeading="Versions in use"
            versions={[
              { icon: "guide", name: "Guidelines v1.1", sub: "Published June 2026", badge: "In use" },
              { icon: "doc", name: "Mandatory fields document", sub: "February 2026 · 51 fields", badge: "In use" },
            ]}
            changedHeading="What changed from v1.0" affected="217 invoices affected"
            changes={[
              { title: "The buyer's emirate is now needed for UAE buyers", sub: "31 customers have an address written as free text.", count: 142, unit: "invoices", pct: 100 },
              { title: "Units of measure must use standard codes", sub: "Bags becomes BG, Nos becomes H87. 23 products.", count: 64, unit: "invoices", pct: 45 },
              { title: "A credit note must point to its original invoice", sub: "11 credit notes have no reference yet.", count: 11, unit: "invoices", pct: 8 },
            ]}
            rescored={{ title: "Re-scored 217 invoices on 2 Sep 2026", sub: "Each one was checked again under v1.1." }}
            trust={fcTrust} closeLabel="Close" primaryLabel="See affected invoices"
          />
        }
        ripple={
          <ChangeDrawer
            title="Decision d-1 · Sunset API v1"
            subtitle="What was decided and who it reaches. Ripple follows the documents and the graph, nothing else."
            versionsHeading="Versions in use"
            versions={[
              { icon: "guide", name: "RFC-14", sub: "Sunset API v1 · decided Sep 22, 2026", badge: "In use" },
              { icon: "doc", name: "Sunset date", sub: "Jan 31, 2027 · 2 contracts run to Jun 30", badge: "In use" },
            ]}
            changedHeading="What changed from the plan" affected="40 customers affected"
            changes={[
              { title: "The sunset date moved to Jan 31, 2027", sub: "Northwind Capital and Halden Bank are guaranteed v1 until Jun 30.", count: 40, unit: "customers", pct: 100 },
              { title: "A depth-4 dependency was found", sub: "Data reaches api-v1 via reporting-export, billing-sync and api-gateway.", count: 1, unit: "team", pct: 20 },
              { title: "Three teams were never told", sub: "Security, Legal and DevRel have no acknowledgement.", count: 3, unit: "teams", pct: 60 },
            ]}
            rescored={{ title: "Conflict found on 6 Oct 2026", sub: "Northwind's contract guarantees v1 past the sunset date." }}
            trust={rpTrust} closeLabel="Close" primaryLabel="See affected teams"
          />
        }
      />
      <RefRow {...common} n={11} name="SteppedBars" wide crop="45% 30%"
        replica={
          <SteppedBars
            title="Would our invoices pass today?" figure="71%" chip="25 pts"
            text="1,312 of 1,846 invoices from Jul to Sep 2026 would pass all 51 mandatory fields today."
            kv={[{ label: "First check", value: "46% on 24 Aug 2026" }, { label: "Rule set", value: "v1.1, 51 mandatory fields" }]}
            columns={[["24 Aug", 46], ["31 Aug", 49], ["7 Sep", 53], ["14 Sep", 58], ["21 Sep", 61], ["28 Sep", 66], ["5 Oct", 69], ["12 Oct", 71]].map(([date, v]) => ({ date: String(date), value: Number(v), label: `${v}%` }))}
            min={33} max={100} tooltip={{ at: 6, text: ["1,312 pass", "534 fail"] }}
          />
        }
        ripple={
          <SteppedBars
            title="Are the affected teams told?" figure="40%" chip="40 pts"
            text="2 of 5 affected teams have acknowledged the sunset of API v1. Security, Legal and DevRel have not."
            kv={[{ label: "Decision", value: "d-1 · Sunset API v1" }, { label: "Told", value: "Support and Sales" }]}
            columns={[["24 Aug", 0], ["31 Aug", 0], ["7 Sep", 0], ["14 Sep", 0], ["21 Sep", 40], ["28 Sep", 40], ["5 Oct", 40], ["12 Oct", 40]].map(([date, v]) => ({ date: String(date), value: Number(v), label: `${v}%` }))}
            min={0} max={70} tooltip={{ at: 6, text: ["2 told", "3 not told"] }}
          />
        }
      />
      <RefRow {...common} n={12} name="InlineAsk" crop="25% 82%"
        replica={<InlineAsk heading="What would you like to check next?" before="Show me which customers cause the most failures in" chip="/buyer tax ID" />}
        ripple={<InlineAsk heading="What would you like to check next?" before="Show me who wasn't told in" chip="/system api-v1" />}
      />
      <RefRow {...common} n={13} name="TrustChecklist" crop="90% 85%"
        replica={<div className="rounded-[var(--ref-radius)] border border-hairline bg-raised p-5"><TrustChecklist {...fcTrust} /></div>}
        ripple={<div className="rounded-[var(--ref-radius)] border border-hairline bg-raised p-5"><TrustChecklist {...rpTrust} /></div>}
      />
    </div>
  );
}
