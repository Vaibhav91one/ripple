import { CalendarClock, FileText, Scale, UserX, Users } from "lucide-react";
import { ActionToast } from "@/components/ui/action-toast";
import { EvidenceDiff } from "@/components/ui/evidence-diff";
import { ExplainBox } from "@/components/ui/explain-box";
import { SeverityPanel } from "@/components/ui/severity-panel";
import { StatusStrip } from "@/components/ui/status-strip";
import { ResolveSample } from "../ResolveSample";

export default function ExceptionSection() {
  return (
    <div className="space-y-8">
      <StatusStrip crumb={["Conflicts", "Northwind contract vs API v1 sunset"]} title="Northwind contract vs API v1 sunset" status={{ label: "Open", tone: "conflict" }}
        meta="ctr-1 · Northwind Capital · $120,000 ARR at stake · Detected Oct 6, 2026"
        cells={[{ label: "Status", value: "Open", pill: "conflict" }, { label: "Owner", value: "Legal" }, { label: "Next action", value: "Tell Legal and amend or extend" }]} />
      <EvidenceDiff title="Evidence" found="Found in the contract, clause 7.2" action="Open original" docLine="v1 available until 2027-06-30"
        groups={[
          { label: "On the contract", chips: [{ text: "2027" }, { text: "06", tone: "covered" }, { text: "30", tone: "covered" }], caption: "ctr-1: guarantees availability of API v1 until 2027-06-30" },
          { label: "On the decision", chips: [{ text: "2027" }, { text: "01", tone: "conflict" }, { text: "31", tone: "conflict" }], caption: "RFC-14: API v1 will be shut down on Jan 31, 2027" },
        ]} />
      <ExplainBox title="Why this conflicts" body="RFC-14 shuts API v1 down on Jan 31, 2027, but Northwind's contract (ctr-1, clause 7.2) guarantees v1 until 2027-06-30. Legal was never consulted, so the guarantee would be broken five months early." />
      <ResolveSample heading="How do you want to resolve it?" options={[
        { id: "extend", title: "Extend v1 for Northwind until the contract ends", tag: "Recommended", sub: "Keep v1 alive for ctr-1 until 2027-06-30 and migrate the other customers by Jan 31." },
        { id: "amend", title: "Amend the contract", locked: true, sub: "Not available. Only Legal can change a signed contract." },
        { id: "keep", title: "Keep the date and tell Legal now", sub: "Sunset stays Jan 31, 2027. Legal hears about ctr-1 today and owns the fallout." },
      ]} />
      <SeverityPanel heading="Why it is first" level="Critical"
        rows={[{ icon: FileText, label: "ARR at risk", value: "$180,000" }, { icon: CalendarClock, label: "Days to sunset", value: "117 days" }, { icon: Users, label: "Customers on v1", value: "40" }, { icon: UserX, label: "Legal", value: "Never told" }]}
        supplier={{ name: "Northwind Capital", sub: "Enterprise · US", logo: Scale, link: "Open contract", rows: [{ label: "Status", value: "Contract at risk", pill: "gap" }, { label: "Contract", value: "ctr-1" }, { label: "ARR", value: "$120,000" }, { label: "Guaranteed until", value: "Jun 30, 2027" }] }}
        note={{ title: "Legal has not been told", body: "Planning meeting on Sep 22 confirmed the sunset. Legal has not been consulted yet." }} />
      <ActionToast title="Legal acknowledged the brief" body="The gap for d-1 is now 2 teams." time="just now" action="View decision" dismiss="Dismiss" />
    </div>
  );
}
