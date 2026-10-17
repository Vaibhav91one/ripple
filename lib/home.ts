// Server side of GET /api/home: one payload for "what does this mean for me today?". It composes the inbox (briefs,
// reviews, waiting-on, briefs sent), the team's ripple per open decision, its tasks, the viewer's notifications and,
// with Postgres, the approvals and access requests they can decide. Redaction happens in handle(), not here.
import { z } from "zod";
import { encodeAckToken } from "./ack-token";
import { claimsFor } from "./briefs";
import { env } from "./env";
import { roQuery } from "./graph/client";
import { decisions, inbox, load, ripple } from "./graph/queries";
import { TEAM_PERSON } from "./lens";
import { Home, type Home as HomeT } from "./schemas";
import type { Context } from "./server/context";
import { latestOpenDecisionId, rippleAngle } from "./teams/run";

const TTL = 14 * 86400;
const TaskRow = z.object({ id: z.string(), title: z.string(), status: z.enum(["open", "in_review"]), dueAt: z.number().nullable(), mine: z.boolean() });
const empty: HomeT = {
  teamId: null, inbox: { forMe: [], sent: [] }, briefs: [], hits: [], tasks: [], approvals: [], accessRequests: [],
  angle: null, conflicts: 0, notifications: { notifications: [], unread: 0 },
};

/** Pending actions the viewer may decide: admin sees all, a lead or change owner the kinds their role owns. */
async function pendingFor(ctx: Context) {
  const v = ctx.viewer;
  if (v.kind !== "user" || !env().DATABASE_URL) return [];
  const [{ and, desc, eq }, { db }, { pendingActions }, { OWNER_ROLE }] = await Promise.all([
    import("drizzle-orm"), import("./db"), import("./db/schema"), import("./actions/executors"),
  ]);
  const rows = await db().select().from(pendingActions)
    .where(and(eq(pendingActions.orgId, ctx.org.id), eq(pendingActions.status, "pending"))).orderBy(desc(pendingActions.requestedAt)).limit(50);
  return rows
    .filter((r) => v.role === "admin" || v.role === (OWNER_ROLE as Record<string, string>)[r.kind])
    .map((r) => ({ id: r.id, kind: r.kind, requestedAt: r.requestedAt.toISOString() }));
}

async function notificationsFor(ctx: Context): Promise<HomeT["notifications"]> {
  const v = ctx.viewer;
  if (v.kind !== "user" || !v.personId || !env().DATABASE_URL) return empty.notifications;
  return (await import("./notify/inbox")).listNotifications(ctx.org.id, v.personId, 10);
}

export async function computeHome(ctx: Context): Promise<HomeT> {
  const { graph: g, now, viewer } = ctx;
  const teamId = viewer.teamIds[0];
  const personId = (viewer.kind === "user" ? viewer.personId : undefined) ?? (viewer.kind === "anon" ? TEAM_PERSON[teamId ?? ""] : undefined);
  if (!teamId || !personId) return { ...empty, teamId: teamId ?? null, notifications: await notificationsFor(ctx) };

  const [inb, tasks, pending, notifications, latest] = await Promise.all([
    inbox(g, personId, now),
    roQuery(g, load("home-tasks").text, { person: personId, team: teamId }).then((r) => z.array(TaskRow).parse(r)),
    pendingFor(ctx),
    notificationsFor(ctx),
    latestOpenDecisionId(g),
  ]);

  const open = (await decisions(g)).data.filter((d) => d.status !== "superseded");
  const hits: HomeT["hits"] = [];
  let conflicts = 0;
  for (const d of open) {
    const r = await ripple(g, d.id, now);
    if (!r.teams.some((t) => t.teamId === teamId)) continue;
    const nOpen = r.conflicts.filter((c) => c.status === "open").length;
    const status = r.gap.includes(teamId) ? (nOpen ? "conflict" : "gap") : "covered";
    if (status === "conflict") conflicts += nOpen;
    hits.push({ decisionId: d.id, title: d.title, status, conflicts: nOpen, contractIds: [...new Set(r.conflicts.filter((c) => c.status === "open").flatMap((c) => c.contractIds))], why: claimsFor(r, teamId).map((c) => ({ text: c.text, source: c.sources[0] })) });
  }

  const tok = (decisionId: string, r: "seen" | "concern" | "not_relevant") =>
    encodeAckToken({ teamId, decisionId, exp: now + TTL, o: ctx.org.id, p: personId, r });
  const briefs = inb.data.forMe.flatMap((i) =>
    i.kind === "brief"
      ? [{ id: i.id, decisionId: i.decisionId, title: i.title, at: i.at, tokens: viewer.kind === "user" ? { seen: tok(i.decisionId, "seen"), concern: tok(i.decisionId, "concern"), not_relevant: tok(i.decisionId, "not_relevant") } : null }]
      : [],
  );

  return Home.parse({
    teamId, inbox: inb.data, briefs, hits, tasks,
    approvals: pending.filter((p) => p.kind !== "access_request"),
    accessRequests: pending.filter((p) => p.kind === "access_request"),
    angle: await rippleAngle(g, teamId, now, latest),
    conflicts, notifications,
  });
}
