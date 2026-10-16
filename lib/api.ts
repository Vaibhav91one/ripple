import type {
  Artifact,
  BottleneckRow,
  Change,
  Decision,
  InboxItem,
  RippleResult,
  StreamEvent,
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

/** Mock replies with the canned "Who knows the v1 auth flow?" sequence for any question. */
export async function* askStream(
  question: string,
): AsyncGenerator<StreamEvent> {
  void question;
  for (const e of m.askEvents) yield e;
}
