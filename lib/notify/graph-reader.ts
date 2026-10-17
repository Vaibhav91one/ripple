// A synchronous GraphReader built from a few preloaded queries, so route() stays pure. Build once per event.
import { roQuery, type Graph } from "../graph/client";
import type { GraphReader } from "./types";

export type Snapshot = {
  people: { id: string; title: string | null; teamId: string | null; email?: string | null }[];
  /** A Change or Decision: its owner, the systems it touches, a revision string. */
  changes: { id: string; owner: string | null; systems: string[]; revision: string }[];
  /** team ACKED change, by whom */
  acks: { changeId: string; teamId: string; by: string | null }[];
  owns: { teamId: string; systemId: string }[];
  tasks: { id: string; assigneeId: string | null }[];
};

const LEAD = /lead|manager|head|director|counsel|chief|cto|coo|ceo/i; // same rule as create-tasks.cypher

export function snapshotGraphReader(s: Snapshot): GraphReader {
  const person = new Map(s.people.map((p) => [p.id, p]));
  const change = new Map(s.changes.map((c) => [c.id, c]));
  const leadOf = (teamId: string) => s.people.filter((p) => p.teamId === teamId && LEAD.test(p.title ?? "")).map((p) => p.id).sort()[0] ?? null;
  const ownersOf = (systemId: string) => s.owns.filter((o) => o.systemId === systemId).map((o) => o.teamId);
  const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x && person.has(x)))];
  const ackedTeams = (id: string) => new Set(s.acks.filter((a) => a.changeId === id).map((a) => a.teamId));
  return {
    changeOwner: (id) => { const o = change.get(id)?.owner; return o && person.has(o) ? o : null; },
    // gap = teams owning a touched system that have not acknowledged
    teamOwners: (id) => { const acked = ackedTeams(id); return uniq((change.get(id)?.systems ?? []).flatMap(ownersOf).filter((t) => !acked.has(t)).map(leadOf)); },
    systemOwners: (id) => uniq((change.get(id)?.systems ?? []).flatMap(ownersOf).map(leadOf)),
    acknowledgers: (id) => uniq(s.acks.filter((a) => a.changeId === id).map((a) => a.by)),
    taskAssignees: (id) => uniq([s.tasks.find((t) => t.id === id)?.assigneeId]),
    teamLead: (id) => { const t = person.get(id)?.teamId; const l = t ? leadOf(t) : null; return l && l !== id ? l : null; },
    resourceOwners: (r) => uniq(ownersOf(r).map(leadOf)),
    prOwners: () => [], // ponytail: no PR -> owner edge in the graph yet; wire up with the GitHub connector
    digestRecipients: () => s.people.map((p) => p.id),
    revision: (subj) => change.get(subj.id)?.revision ?? "0",
  };
}

export async function loadSnapshot(g: Graph): Promise<Snapshot> {
  const [people, changes, acks, owns, tasks] = await Promise.all([
    roQuery<Snapshot["people"][number]>(g,
      "MATCH (p:Person) WHERE p.active IS NULL OR p.active = true RETURN p.id AS id, p.title AS title, p.teamId AS teamId, p.email AS email"),
    roQuery<Snapshot["changes"][number]>(g,
      `MATCH (c) WHERE c:Change OR c:Decision
       OPTIONAL MATCH (c)-[r:AFFECTED|SUNSETS]->(s:System) WHERE r.valid_to IS NULL
       RETURN c.id AS id, c.owner AS owner, collect(DISTINCT s.id) AS systems,
         coalesce(c.status, '') + ':' + toString(coalesce(c.effective_at, 0)) AS revision`),
    roQuery<Snapshot["acks"][number]>(g, "MATCH (t:Team)-[a:ACKED]->(d) RETURN d.id AS changeId, t.id AS teamId, a.by AS by"),
    roQuery<Snapshot["owns"][number]>(g, "MATCH (t:Team)-[:OWNS]->(s:System) RETURN t.id AS teamId, s.id AS systemId"),
    roQuery<Snapshot["tasks"][number]>(g, "MATCH (k:Task) RETURN k.id AS id, k.assigneeId AS assigneeId"),
  ]);
  return { people, changes, acks, owns, tasks };
}

/** Preloaded reader plus the address book (email by person id) the delivery step needs. */
export async function loadGraphReader(g: Graph) {
  const snap = await loadSnapshot(g);
  return { reader: snapshotGraphReader(snap), emailOf: (personId: string) => snap.people.find((p) => p.id === personId)?.email ?? null,
    teamOf: (personId: string) => snap.people.find((p) => p.id === personId)?.teamId ?? null };
}
