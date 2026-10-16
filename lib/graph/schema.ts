import { query, type Graph } from "./client";

/** Every node label gets a lookup index on `id`. `Artifact` is the shared second label. */
export const LABELS = [
  "Team", "Person", "System", "Customer", "Deal", "Contract", "Decision",
  "Incident", "Task", "Artifact", "Doc", "Ticket", "Message", "PR",
  "Clause", "Control", "Framework", "Vendor", "Finding", "Risk", "Page", "DocsStats", "Goal",
] as const;

const STATEMENTS = [
  ...LABELS.map((l) => `CREATE INDEX FOR (n:${l}) ON (n.id)`),
  "CREATE FULLTEXT INDEX FOR (a:Artifact) ON (a.text)",
  "CREATE VECTOR INDEX FOR (a:Artifact) ON (a.emb) OPTIONS {dimension:384, similarityFunction:'cosine'}",
];

/** Idempotent: re-running ignores "already indexed". */
export async function ensureSchema(graph: Graph): Promise<void> {
  for (const s of STATEMENTS) {
    try {
      await query(graph, s);
    } catch (e) {
      if (!/already indexed/i.test(String(e))) throw e;
    }
  }
}
