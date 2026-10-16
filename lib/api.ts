import type {
  Artifact,
  BottleneckRow,
  Change,
  Decision,
  InboxItem,
  RippleResult,
  WhoKnowsRow,
} from "@/lib/schemas";
import * as m from "@/lib/mock/ledgerly";

// Mock-backed for now; signatures match the Phase 3 route handlers.

export async function getDecisions(): Promise<Decision[]> {
  return m.decisions;
}

export async function getRipple(decisionId: string): Promise<RippleResult> {
  if (decisionId !== m.rippleResult.decision.id)
    throw new Error(`No ripple for decision ${decisionId}`);
  return m.rippleResult;
}

/** `since` is epoch seconds. */
export async function getChanges(since: number): Promise<Change[]> {
  return m.changes.filter((c) => c.at >= since);
}

export async function getBottleneck(): Promise<BottleneckRow[]> {
  return m.bottleneck;
}

export async function getWhoKnows(systemId: string): Promise<WhoKnowsRow[]> {
  return m.whoKnows[systemId] ?? [];
}

export async function getInbox(personId: string): Promise<InboxItem[]> {
  return m.inboxes[personId] ?? [];
}

export async function getSource(artifactId: string): Promise<Artifact> {
  const a = m.artifacts.find((x) => x.id === artifactId);
  if (!a) throw new Error(`No artifact ${artifactId}`);
  return a;
}

/** Streams `/api/ask` (server-sent events); the route falls back to the cached mock answer without a model. */
export async function* askStream(question: string): AsyncGenerator<unknown> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || !res.body) {
    const msg = await res.json().then((j: { error?: string }) => j.error, () => undefined);
    throw new Error(msg ?? `Ask failed (${res.status})`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += value;
    const frames = buf.split("\n\n");
    buf = frames.pop()!;
    for (const f of frames) {
      const data = f.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
      if (data) yield JSON.parse(data);
    }
  }
}
