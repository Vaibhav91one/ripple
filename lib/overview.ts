// Server side of GET /api/overview: KPIs, open decisions, blockers, recent changes, the per-day activity series,
// who knows the sunset system and a strip of the seven team workspaces. Built from the same cypher wrappers as the other routes.
import { z } from "zod";
import { roQuery, type Graph } from "./graph/client";
import { decisions, diff, load, ripple, whoKnows } from "./graph/queries";
import { Blocker, Overview, WhoKnowsRow } from "./schemas";
import { TEAM_IDS } from "./teams/dashboards";
import { ACTIVITY_DAYS, activitySeries } from "./teams/util";

const DAY = 86400;
const n = z.coerce.number();

export async function computeOverview(g: Graph, now: number): Promise<Overview> {
  const dec = (await decisions(g)).data.filter((d) => d.status !== "superseded");
  const rips = await Promise.all(dec.map((d) => ripple(g, d.id, now)));
  const main = rips[0];
  const edges = z.array(z.object({ type: z.string(), at: n })).parse(
    await roQuery(g, load("overview-activity").text, { since: now - ACTIVITY_DAYS * DAY }),
  );
  const sunset = main?.edges.find((e) => e.type === "SUNSETS")?.to ?? null;
  const teamRows = z.array(z.object({ id: z.string(), name: z.string(), people: n, owner: z.boolean() })).parse(
    await roQuery(g, load("overview-teams").text, { sunset }),
  );
  const blockers = z.array(Blocker).parse(await roQuery(g, load("overview-blockers").text));
  const ripTeam = (id: string) => main?.teams.find((t) => t.teamId === id);
  const told = (id: string) => !ripTeam(id) || ripTeam(id)!.involved || ripTeam(id)!.acked;
  return Overview.parse({
    now,
    kpis: main ? [
      { id: "teams-affected", label: "Teams affected", value: main.counts.teamsAffected, unit: "count" },
      { id: "not-told", label: "Teams not told", value: main.counts.notTold, unit: "count", tone: main.counts.notTold ? "bad" : "ok" },
      { id: "conflicts", label: "Open conflicts", value: main.counts.conflicts, unit: "count", tone: main.counts.conflicts ? "bad" : "ok" },
      { id: "arr-at-risk", label: "ARR at risk", value: main.counts.arrAtRisk, unit: "usd", tone: main.counts.arrAtRisk ? "bad" : "ok" },
      { id: "customers", label: "Customers on API v1", value: main.counts.customers, unit: "count", tone: "warn" },
    ] : [],
    openDecisions: dec.map((d, i) => ({ decision: d, notTold: rips[i].gap })).filter((x) => x.notTold.length > 0),
    blockers,
    recentChanges: (await diff(g, now - 30 * DAY)).data.slice(0, 8),
    activity: activitySeries(edges, now),
    whoKnows: sunset ? z.array(WhoKnowsRow).parse((await whoKnows(g, sunset)).data) : [],
    teams: TEAM_IDS.map((id) => {
      const t = teamRows.find((x) => x.id === id);
      return { teamId: id, name: t?.name ?? id, people: t?.people ?? 0, affected: !!ripTeam(id) || !!t?.owner, told: !!told(id) };
    }),
  });
}
