import type {
  Artifact,
  BottleneckRow,
  Change,
  Decision,
  InboxItem,
  Overview,
  Person,
  RippleResult,
  StreamEvent,
  WhoKnowsRow,
} from "@/lib/schemas";
import { applySunsetMove } from "@/components/live/applySunsetMove";
import * as m from "./ledgerly";
import * as v2 from "./ledgerly-v2";
import { mockOverview, mockTeamDashboard } from "./teams";
import type { TeamId } from "@/lib/teams/dashboards";

// Offline fallback (NEXT_PUBLIC_RIPPLE_OFFLINE=1) and test fixture: same signatures as lib/api.ts, backed by lib/mock/ledgerly.ts.

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

export async function getPeople(): Promise<Person[]> {
  return m.people;
}

export async function getNames(): Promise<Record<string, string>> {
  return Object.fromEntries(
    [m.teams, m.people, m.systems, v2.chainSystems, m.customers, m.decisions, m.deals, m.contracts, m.artifacts, v2.extraArtifacts, v2.findings, v2.tasks]
      .flat()
      .map((x) => [x.id, "name" in x ? x.name : x.title]),
  );
}

/** Offline stand-in for POST /api/change: same assumption as applySunsetMove. */
export async function postChange(decisionId: string, newOn: number): Promise<RippleResult> {
  return applySunsetMove(await getRipple(decisionId), newOn);
}

export async function getInbox(personId: string): Promise<InboxItem[]> {
  return m.inboxes[personId] ?? [];
}

export async function getSource(artifactId: string): Promise<Artifact> {
  const a = [...m.artifacts, ...v2.extraArtifacts].find((x) => x.id === artifactId);
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

export async function getTeamDashboard(team: TeamId) {
  return mockTeamDashboard(team);
}

export async function getOverview(): Promise<Overview> {
  return mockOverview();
}
