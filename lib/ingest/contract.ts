// Contract text -> Contract + numbered Clause proposals (Contract Sentinel's structure). Heuristic, no model: a clause starts at a line
// like "7.2 Title. Body", "Section 7.2", "Clause 7.2" or "7.", and runs to the next one. Applied directly (structured), restricted to Legal on read.
import { sha256 } from "./extract";
import type { GraphProposal } from "../connectors/define";

export type ClauseDraft = { number: string; title: string; text: string };

const START = /^(?:(?:section|clause|article)\s+)?(\d{1,3}(?:\.\d{1,3})*)[.)]?\s+(\S.*)$/i;

export function findClauses(text: string): ClauseDraft[] {
  const found: { number: string; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || /^\[Page \d+\]$/.test(line)) continue;
    const m = START.exec(line);
    if (m) found.push({ number: m[1], lines: [m[2]] });
    else found.at(-1)?.lines.push(line);
  }
  const seen = new Set<string>();
  return found.flatMap(({ number, lines }, i) => {
    const body = lines.join(" ");
    if (found[i + 1]?.number.startsWith(`${number}.`)) return []; // a heading ("1. Definitions") whose children follow
    if (seen.has(number)) return [];
    seen.add(number);
    const title = (/^(.{3,80}?)[.:]\s/.exec(body)?.[1] ?? body.slice(0, 80)).trim();
    return [{ number, title, text: body }];
  });
}

const day = (s?: string) => (s ? Math.floor(Date.parse(`${s}T00:00:00Z`) / 1000) : undefined);

export type ContractMeta = { title: string; customerId?: string; effective?: string; expires?: string };

export function contractProposals(text: string, meta: ContractMeta): { contractId: string; clauses: ClauseDraft[]; proposals: GraphProposal[] } {
  const contractId = `contract:${sha256(text).slice(0, 12)}`;
  const src = `upload:${contractId}`;
  const base = { src, confidence: 1, structured: true } as const;
  const clauses = findClauses(text);
  const effective = day(meta.effective), ends = day(meta.expires);
  const proposals: GraphProposal[] = [
    { op: "merge_node", label: "Contract", id: contractId, ...base,
      props: { name: meta.title, approvalState: "draft", noticeDays: 0, value: 0, ...(effective && { effectiveAt: effective }), ...(ends && { endsAt: ends }) } },
  ];
  if (meta.customerId) proposals.push({ op: "merge_edge", type: "PARTY_TO", from: { label: "Contract", id: contractId }, to: { label: "Customer", id: meta.customerId }, props: {}, ...base });
  for (const c of clauses) {
    const id = `${contractId}:${c.number}`;
    proposals.push(
      { op: "merge_node", label: "Clause", id, ...base, props: { contractId, number: c.number, title: c.title, text: c.text, risk: "low", v1Related: false } },
      { op: "merge_edge", type: "HAS_CLAUSE", from: { label: "Contract", id: contractId }, to: { label: "Clause", id }, props: {}, ...base },
    );
  }
  return { contractId, clauses, proposals };
}
