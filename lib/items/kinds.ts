// Registry of item kinds (a ticket, a contract, a decision...) for /items/<kind>/<id>. One adapter per kind: how to find
// the node in the graph and how to read its title, status, owner and source link from the node's properties.
export type ItemKind = string;
export type Props = Record<string, unknown>;

export interface ItemAdapter {
  kind: ItemKind;
  label: string;
  /** lucide icon name */
  icon: string;
  /** the node's graph label */
  graphLabel: string;
  title: (n: Props) => string;
  status: (n: Props) => string | null;
  /** team or person id that owns the item */
  owner: (n: Props) => string | null;
  sourceUrl: (n: Props) => string | null;
  /** optional extra section on the item page: the node's out-edges of this type, listed with their quotes (a contract's clauses) */
  extra?: { title: string; edgeType: string };
}

const s = (v: unknown) => (typeof v === "string" && v ? v : null);
const pick = (...keys: string[]) => (n: Props) => keys.map((k) => s(n[k])).find(Boolean) ?? null;
const none = () => null;
const a = (kind: string, label: string, icon: string, graphLabel: string, o: Partial<ItemAdapter> = {}): ItemAdapter => ({
  kind, label, icon, graphLabel, title: (n) => pick("name", "title")(n) ?? String(n.id), status: pick("status"), owner: none, sourceUrl: none, ...o,
});
const artifact = { owner: pick("assigneeId", "author"), sourceUrl: pick("uri") };

export const ITEM_KINDS: Record<ItemKind, ItemAdapter> = Object.fromEntries(
  [
    a("pr", "Pull request", "git-pull-request", "PR", { ...artifact, status: pick("state") }),
    a("ticket", "Ticket", "ticket", "Ticket", artifact),
    a("doc", "Document", "file-text", "Doc", { ...artifact, status: pick("docKind") }),
    a("message", "Message", "message-square", "Message", artifact),
    a("contract", "Contract", "file-signature", "Contract", { status: pick("approvalState"), owner: () => "legal", extra: { title: "Clauses", edgeType: "HAS_CLAUSE" } }),
    a("clause", "Clause", "scroll-text", "Clause", { status: pick("risk"), owner: () => "legal" }),
    a("customer", "Customer", "building-2", "Customer", { status: pick("tier") }),
    a("deal", "Deal", "handshake", "Deal", { status: pick("stage"), owner: pick("ownerId") }),
    a("system", "System", "server", "System", { owner: pick("onCallPersonId") }),
    a("person", "Person", "user", "Person", { status: (n) => (n.active === false ? "inactive" : "active"), owner: pick("teamId") }),
    a("team", "Team", "users", "Team", { owner: pick("id") }),
    a("control", "Control", "shield-check", "Control", { owner: pick("ownerId") }),
    a("finding", "Finding", "search-check", "Finding", { owner: pick("ownerId") }),
    a("task", "Task", "square-check", "Task", { owner: pick("assigneeId", "teamId") }),
    a("decision", "Decision", "scale", "Decision", { status: pick("status") }),
    a("incident", "Incident", "siren", "Incident", { status: pick("status") }),
    a("change", "Change", "git-commit-horizontal", "Change"),
    // placeholder: access requests are not in the graph yet, so every id is a 404 until they are
    a("access-request", "Access request", "key-round", "AccessRequest"),
  ].map((x) => [x.kind, x]),
);
