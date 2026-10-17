// Nizam's Clearbill exception page (image recreation). Rows for /styleguide/refs; one RefRow per component.
import { CalendarClock, FileText, RefreshCw, Scale, ShieldCheck, UserX, Users, Wheat } from "lucide-react";
import { RefRow } from "../RefRow";
import { ActionToast } from "./action-toast";
import { EvidenceDiff } from "./evidence-diff";
import { ExplainBox } from "./explain-box";
import { ResolveOptionsDemo } from "./resolve-options-demo";
import { SeverityPanel } from "./severity-panel";
import { StatusStrip } from "./status-strip";

const common = { from: "Nizam, Clearbill", post: "https://x.com/nizamdesign/status/2111074428469850242", license: "image recreation", img: "05-invoice-exceptions.jpg", skin: "nizam" } as const;

export default function ClearbillSection() {
  return (
    <div className="space-y-8">
      <RefRow {...common} n={14} name="StatusStrip" crop="40% 22%" wide
        replica={<StatusStrip crumb={["Exceptions", "VAT number mismatch"]} title="VAT number mismatch" status={{ label: "Resolved", tone: "covered" }}
          meta="INV-2847 · Falaj Trading LLC · AED 48,500.00 at stake · Detected Oct 4, 10:43 AM"
          cells={[{ label: "Status", value: "Accepted", pill: "covered" }, { label: "Owner", value: "Supplier · Mazen Haddadin" }, { label: "Next action", value: "None, payment continues" }]} />}
        ripple={<StatusStrip crumb={["Conflicts", "Northwind contract vs API v1 sunset"]} title="Northwind contract vs API v1 sunset" status={{ label: "Open", tone: "conflict" }}
          meta="ctr-1 · Northwind Capital · $120,000 ARR at stake · Detected Oct 6, 2026"
          cells={[{ label: "Status", value: "Open", pill: "conflict" }, { label: "Owner", value: "Legal" }, { label: "Next action", value: "Tell Legal and amend or extend" }]} />} />
      <RefRow {...common} n={15} name="EvidenceDiff" crop="30% 40%" wide
        replica={<EvidenceDiff title="Evidence" found="Found in the invoice header" action="Open original" docLine="TRN 100 3847 2560 0003"
          groups={[
            { label: "On the invoice", chips: [{ text: "100" }, { text: "3847" }, { text: "2560", tone: "conflict" }, { text: "0003" }], caption: "Typed by the supplier on the invoice" },
            { label: "Verified supplier record", chips: [{ text: "100" }, { text: "3847" }, { text: "2650", tone: "covered" }, { text: "0003" }], caption: "Verified against the tax register on Mar 3, 2026" },
          ]} />}
        ripple={<EvidenceDiff title="Evidence" found="Found in the contract, clause 7.2" action="Open original" docLine="v1 available until 2027-06-30"
          groups={[
            { label: "On the contract", chips: [{ text: "2027" }, { text: "06", tone: "covered" }, { text: "30", tone: "covered" }], caption: "ctr-1: guarantees availability of API v1 until 2027-06-30" },
            { label: "On the decision", chips: [{ text: "2027" }, { text: "01", tone: "conflict" }, { text: "31", tone: "conflict" }], caption: "RFC-14: API v1 will be shut down on Jan 31, 2027" },
          ]} />} />
      <RefRow {...common} n={16} name="ExplainBox" crop="30% 56%" wide
        replica={<ExplainBox title="Why this failed" body="The VAT number on the invoice differs from the verified supplier record. Two digits are swapped, which points to a typing error. A tax invoice with a wrong VAT number is rejected, so the invoice cannot proceed." />}
        ripple={<ExplainBox title="Why this conflicts" body="RFC-14 shuts API v1 down on Jan 31, 2027, but Northwind's contract (ctr-1, clause 7.2) guarantees v1 until 2027-06-30. Legal was never consulted, so the guarantee would be broken five months early." />} />
      <RefRow {...common} n={17} name="ResolveOptions" crop="30% 74%" wide
        replica={<ResolveOptionsDemo heading="How do you want to resolve it?" options={[
          { id: "ask", title: "Request a correction from the supplier", tag: "Recommended", sub: "Clearbill sends a ready message with a secure link. The supplier fixes one field and resubmits." },
          { id: "fix", title: "Correct it here and resubmit", locked: true, sub: "Not available. Only the supplier can change a tax invoice it issued." },
          { id: "reject", title: "Reject the invoice", sub: "Stops this invoice. The supplier has to issue a new one, and payment moves past Oct 6." },
        ]} />}
        ripple={<ResolveOptionsDemo heading="How do you want to resolve it?" options={[
          { id: "extend", title: "Extend v1 for Northwind until the contract ends", tag: "Recommended", sub: "Keep v1 alive for ctr-1 until 2027-06-30 and migrate the other customers by Jan 31." },
          { id: "amend", title: "Amend the contract", locked: true, sub: "Not available. Only Legal can change a signed contract." },
          { id: "keep", title: "Keep the date and tell Legal now", sub: "Sunset stays Jan 31, 2027. Legal hears about ctr-1 today and owns the fallout." },
        ]} />} />
      <RefRow {...common} n={18} name="SeverityPanel" crop="90% 50%"
        replica={<SeverityPanel heading="Why it is first" level="Critical"
          rows={[{ icon: FileText, label: "Invoice value", value: "AED 48,500" }, { icon: CalendarClock, label: "Payment deadline", value: "In 2 days" }, { icon: RefreshCw, label: "Repeated failure", value: "3rd in 90 days" }, { icon: ShieldCheck, label: "Compliance", value: "Cannot be submitted" }]}
          supplier={{ name: "Falaj Trading LLC", sub: "Food commodities · Dubai", logo: Wheat, link: "Open supplier profile", rows: [{ label: "Readiness", value: "Action required", pill: "gap" }, { label: "Contact", value: "Mazen Haddadin" }, { label: "Rejected in 90 days", value: "5 of 42 invoices" }, { label: "Average resolution", value: "1.8 days" }] }}
          note={{ title: "Corrected and accepted", body: "Falaj Trading fixed the VAT number at 2:05 PM. Accepted at 2:06 PM." }} />}
        ripple={<SeverityPanel heading="Why it is first" level="Critical"
          rows={[{ icon: FileText, label: "ARR at risk", value: "$180,000" }, { icon: CalendarClock, label: "Days to sunset", value: "117 days" }, { icon: Users, label: "Customers on v1", value: "40" }, { icon: UserX, label: "Legal", value: "Never told" }]}
          supplier={{ name: "Northwind Capital", sub: "Enterprise · US", logo: Scale, link: "Open contract", rows: [{ label: "Status", value: "Contract at risk", pill: "gap" }, { label: "Contract", value: "ctr-1" }, { label: "ARR", value: "$120,000" }, { label: "Guaranteed until", value: "Jun 30, 2027" }] }}
          note={{ title: "Legal has not been told", body: "Planning meeting on Sep 22 confirmed the sunset. Legal has not been consulted yet." }} />} />
      <RefRow {...common} n={19} name="ActionToast" crop="75% 20%"
        replica={<ActionToast title="INV-2847 accepted" body="Falaj Trading corrected the VAT number. All 11 checks passed." time="2:06 PM · 4 min ago" action="View invoice" dismiss="Dismiss" />}
        ripple={<ActionToast title="Legal acknowledged the brief" body="The gap for d-1 is now 2 teams." time="just now" action="View decision" dismiss="Dismiss" />} />
    </div>
  );
}
