// CSV rows -> GraphProposals. Pure (no server imports) so the browser uses the same field lists for the mapping step.
import type { GraphProposal } from "../define";

export type CsvType = "customers" | "deals" | "usage" | "access" | "software";
export type Field = { key: string; label: string; required?: boolean; aliases?: string[] };
export type Mapping = Record<string, string>; // field key -> CSV header ("" = unmapped)
export type CsvRecord = { type: CsvType; mapping: Mapping; row: Record<string, string>; rowNo: number; uploadId: string };

export const CSV_TYPES: { type: CsvType; label: string; hint: string; fields: Field[] }[] = [
  { type: "customers", label: "Customers", hint: "name, domain", fields: [
    { key: "name", label: "Customer name", required: true, aliases: ["customer", "company", "account"] },
    { key: "domain", label: "Domain", aliases: ["website", "url"] },
  ] },
  { type: "deals", label: "Deals", hint: "name, customer, stage, amount", fields: [
    { key: "name", label: "Deal name", required: true, aliases: ["deal", "title"] },
    { key: "customer", label: "Customer", aliases: ["company", "account"] },
    { key: "stage", label: "Stage", aliases: ["status"] },
    { key: "amount", label: "Amount", aliases: ["value", "arr"] },
  ] },
  { type: "usage", label: "Usage", hint: "customer, system, calls_30d, last_seen", fields: [
    { key: "customer", label: "Customer", required: true, aliases: ["company", "account", "customername"] },
    { key: "system", label: "System", required: true, aliases: ["api", "service", "systemid"] },
    { key: "calls_30d", label: "Calls (30 days)", required: true, aliases: ["calls", "requests", "calls30d"] },
    { key: "last_seen", label: "Last seen", aliases: ["lastcall", "lastactive", "date"] },
  ] },
  { type: "access", label: "Access", hint: "email, access group or software", fields: [
    { key: "email", label: "Person email", required: true, aliases: ["person", "user", "mail"] },
    { key: "group", label: "Access group", aliases: ["accessgroup", "role", "team"] },
    { key: "software", label: "Software", aliases: ["app", "tool", "installed"] },
  ] },
  { type: "software", label: "Software", hint: "name, required by system", fields: [
    { key: "name", label: "Software name", required: true, aliases: ["software", "app", "tool"] },
    { key: "required_by", label: "Required by (system id)", aliases: ["requiredby", "system", "systemid"] },
  ] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9@.]+/g, "-").replace(/^-+|-+$/g, "");

/** Best header for each field: the field key first, then an alias. A header is used once. */
export function suggestMapping(type: CsvType, headers: string[]): Mapping {
  const used = new Set<string>();
  const out: Mapping = {};
  for (const f of CSV_TYPES.find((t) => t.type === type)!.fields) {
    const names = [f.key, ...(f.aliases ?? [])].map(norm);
    const h = names.map((n) => headers.find((x) => !used.has(x) && norm(x) === n)).find(Boolean) ?? "";
    if (h) used.add(h);
    out[f.key] = h;
  }
  return out;
}

export const missingRequired = (type: CsvType, mapping: Mapping) =>
  CSV_TYPES.find((t) => t.type === type)!.fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);

type Label = "Customer" | "Deal" | "System" | "Person" | "Software" | "AccessGroup";
type Props = Record<string, string | number>;
type NodeP = Extract<GraphProposal, { op: "merge_node" }>;

/** Throws a readable message for a bad row; the importer reports it with the row number. */
export function mapRow({ type, mapping, row, rowNo, uploadId }: CsvRecord): GraphProposal[] {
  const fields = CSV_TYPES.find((t) => t.type === type)!.fields;
  const get = (k: string) => (mapping[k] ? (row[mapping[k]] ?? "").trim() : "");
  const need = (k: string) => get(k) || (() => { throw new Error(`${fields.find((f) => f.key === k)!.label} is empty`); })();
  const base = { src: `csv:${uploadId}:${rowNo}`, confidence: 1, structured: true };
  const n = (label: Label, id: string, props: Props = {}): NodeP => ({ op: "merge_node", label, id, props, ...base });
  const edge = (t: string, from: NodeP, to: NodeP, props: Props = {}): GraphProposal =>
    ({ op: "merge_edge", type: t, from: { label: from.label, id: from.id }, to: { label: to.label, id: to.id }, props, ...base });
  const customer = (v: string) => n("Customer", `customer:${slug(v)}`, { name: v });
  const num = (label: string, v: string) => {
    const x = Number(v.replace(/[$,]/g, ""));
    if (!Number.isFinite(x)) throw new Error(`${label} "${v}" is not a number`);
    return x;
  };

  if (type === "customers") {
    const name = need("name"), domain = get("domain").toLowerCase();
    return [n("Customer", `customer:${slug(name)}`, { name, ...(domain && { domain }) })];
  }
  if (type === "deals") {
    const name = need("name");
    const deal = n("Deal", `deal:${slug(name)}`, { name, ...(get("stage") && { stage: get("stage") }), ...(get("amount") && { amount: num("Amount", get("amount")) }) });
    const cust = get("customer");
    return cust ? [deal, customer(cust), edge("HAS_DEAL", customer(cust), deal)] : [deal];
  }
  if (type === "usage") {
    const cust = need("customer"), sys = need("system"), calls = num("Calls", need("calls_30d")), seen = get("last_seen");
    if (calls < 0) throw new Error(`Calls "${calls}" is negative`);
    const props: Props = { calls_30d: calls };
    if (seen) {
      const t = Date.parse(seen);
      if (Number.isNaN(t)) throw new Error(`Last seen "${seen}" is not a date`);
      props.last_seen = Math.floor(t / 1000);
    }
    const s = n("System", sys);
    return [customer(cust), s, edge("USES", customer(cust), s, props)];
  }
  if (type === "access") {
    const email = need("email").toLowerCase(), group = get("group"), sw = get("software");
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error(`"${email}" is not an email`);
    if (!group && !sw) throw new Error("Needs an access group or software");
    const p = n("Person", `person:${email}`, { email });
    const out: GraphProposal[] = [p];
    if (group) { const g = n("AccessGroup", `group:${slug(group)}`, { name: group }); out.push(g, edge("HAS_ACCESS", p, g)); }
    if (sw) { const s = n("Software", `software:${slug(sw)}`, { name: sw }); out.push(s, edge("HAS_INSTALLED", p, s)); }
    return out;
  }
  const name = need("name"), by = get("required_by");
  const s = n("Software", `software:${slug(name)}`, { name });
  return by ? [s, n("System", by), edge("REQUIRES", n("System", by), s)] : [s];
}
