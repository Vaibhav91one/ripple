// Client fetch for GET /api/graph (kept out of lib/api.ts, which another change owns).
import { GraphDownError } from "@/lib/api";
import { GraphView, type EvidenceKind } from "@/lib/graph/view";

export async function getGraph(decisionId: string, opts: { team?: string | null; kinds?: EvidenceKind[] } = {}): Promise<GraphView> {
  const q = new URLSearchParams({ d: decisionId });
  if (opts.team) q.set("team", opts.team);
  if (opts.kinds?.length) q.set("kinds", opts.kinds.join(","));
  const res = await fetch(`/api/graph?${q}`);
  if (res.status === 503) throw new GraphDownError();
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `/api/graph: ${res.status}`);
  }
  return GraphView.parse(await res.json());
}
