// Payload -> words. A pending action's payload is JSON; people read a summary line and label/value fields.
import type { ApprovalRow } from "../schemas/approvals";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const human = (k: string) => { const s = k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase(); return s[0].toUpperCase() + s.slice(1); };

/** Flatten to label/value pairs, two levels deep ("Props · amount"). */
function flatten(v: unknown, path: string[] = [], out: { label: string; value: string }[] = []) {
  if (isObj(v) && path.length < 2) {
    for (const [k, x] of Object.entries(v)) flatten(x, [...path, k], out);
  } else if (v !== undefined && v !== null && v !== "") {
    out.push({ label: path.map(human).join(" · ") || "Value", value: typeof v === "string" ? v : Array.isArray(v) && v.every((x) => typeof x !== "object") ? v.join(", ") : JSON.stringify(v) });
  }
  return out;
}

const ref = (r: unknown) => (isObj(r) ? `${str(r.label) ?? ""} ${str(r.id) ?? ""}`.trim() : "?");

function line(kind: string, p: Obj): string {
  if (kind === "graph_merge") {
    if (p.op === "suggest_merge") return `Treat "${str(p.mention)}" as ${str(p.nodeId)}`;
    if (p.op === "merge_node") return `Add ${str(p.label)} ${str(p.id)}`;
    if (p.op === "merge_edge") return `Link ${ref(p.from)} ${str(p.type)} ${ref(p.to)}`;
    if (p.op === "end_edge") return `End ${str(p.type)} from ${ref(p.from)} to ${ref(p.to)}`;
    return `Update ${str(p.label) ?? "node"} ${str(p.id) ?? ""}`.trim();
  }
  const title = str(p.title) ?? str(p.subject) ?? str(p.text);
  const verb: Record<string, string> = { create_task: "Create task", create_issue: "Open GitHub issue", send_slack: "Send Slack message", send_email: "Send email", pr_comment: "Comment on PR", access_request: "Request access", draft_doc: "Draft document" };
  return `${verb[kind] ?? human(kind)}${title ? `: ${title}` : ""}`;
}

/** The connector or source behind a proposal when no agent run made it ("github:pr/12" -> "github"). */
function sourceOf(p: Obj, ev: { src?: string }[]) {
  const src = str(p.src) ?? ev.find((e) => e.src)?.src;
  if (!src) return "connector";
  return src.includes(":") ? src.split(":")[0] : "document";
}

export function summarize(kind: string, payload: unknown, evidence: unknown, agent: string | null) {
  const p = isObj(payload) ? payload : {};
  const ev = (Array.isArray(evidence) ? evidence : []).filter(isObj).map((e) => ({
    src: str(e.src), quote: str(e.quote), confidence: typeof e.confidence === "number" ? e.confidence : undefined, structured: typeof e.structured === "boolean" ? e.structured : undefined,
  }));
  const changeId = str(p.decisionId) ?? null;
  const question = kind === "graph_merge" && p.op === "suggest_merge";
  return {
    summary: line(kind, p),
    fields: flatten(ev.length ? Object.fromEntries(Object.entries(p).filter(([k]) => !["quote", "confidence", "structured"].includes(k))) : p), // those three are the Evidence section
    evidence: ev,
    proposer: agent ?? sourceOf(p, ev),
    changeId,
    group: question ? null : changeId ?? str(p.src) ?? null, // "same entity?" is a judgement call: never bulk
    question: question ? { name: str(p.mention) ?? "", nodeId: str(p.nodeId) ?? "" } : null,
  } satisfies Pick<ApprovalRow, "summary" | "fields" | "evidence" | "proposer" | "changeId" | "group" | "question">;
}
