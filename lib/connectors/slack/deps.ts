// Real wiring for the slack-inbound handler (worker only: DB, graph, model).
import "server-only";
import { eq } from "drizzle-orm";
import { runInteractive } from "../../agent/runtime";
import { db } from "../../db";
import { memberships, orgs } from "../../db/schema";
import { decrypt } from "../../crypto";
import { graphFor, roQuery } from "../../graph/client";
import { ingestDocument } from "../../ingest/pipeline";
import { pickModel } from "../../llm";
import { getMember } from "../../members";
import { safeMessage } from "../../log";
import { slackClient } from "./client";
import type { Deps, InboundJob } from "./interactive";
import { changeForChannel, slackToken } from "./store";
import { messageHook } from "./wire";


const respond: Deps["respond"] = async (url, body) => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) console.error("[slack] response_url", r.status);
};

export async function realDeps(job: InboundJob): Promise<Deps> {
  const [org] = await db().select().from(orgs).where(eq(orgs.id, job.orgId));
  const tokenEnc = await slackToken(job.orgId);
  if (!tokenEnc) throw new Error("slack is not connected for this org");
  const slack = slackClient(decrypt(tokenEnc));
  const graph = () => graphFor(org?.graphName ?? job.orgId);
  let bot: Promise<string> | undefined;
  return {
    botUserId: () => (bot ??= slack.call<{ user_id: string }>("auth.test").then((r) => r.user_id)),
    graph, slack, respond, onMessageEvent: messageHook({ graph, slack }),
    changeForChannel: (c) => changeForChannel(job.orgId, c),
    async asker(slackUserId) {
      try {
        const email = (await slack.call<{ user: { profile?: { email?: string } } }>("users.info", { user: slackUserId })).user.profile?.email?.toLowerCase();
        if (!email) return { viewer: { teamIds: [] } };
        const g = await graph();
        const person = (await roQuery<{ id: string }>(g, "MATCH (p:Person) WHERE toLower(p.email) = $email RETURN p.id AS id LIMIT 1", { email }))[0]?.id;
        if (!person) return { viewer: { teamIds: [] } };
        const [m] = await db().select({ userId: memberships.userId }).from(memberships).where(eq(memberships.personId, person)).limit(1);
        const member = m ? await getMember(job.orgId, m.userId) : null;
        if (member) return { personId: person, viewer: { teamIds: member.teamIds, role: member.role } };
        const teams = await roQuery<{ id: string }>(g, "MATCH (:Person {id: $id})-[:MEMBER_OF]->(t:Team) RETURN t.id AS id", { id: person });
        return { personId: person, viewer: { teamIds: teams.map((t) => t.id), role: "member" } };
      } catch (e) {
        console.error("[slack] viewer lookup failed:", safeMessage(e));
        return { viewer: { teamIds: [] } };
      }
    },
    // We are already in the worker: run the pipeline inline so the reply can say how many edges were proposed.
    ingest: async (i) => {
      const r = await ingestDocument({ org: { id: job.orgId } }, i, { graph: await graph() });
      return { proposals: r.proposals, duplicate: r.duplicate };
    },
    ask(question, g, viewer) {
      const model = pickModel("agent");
      if (!model) return (async function* () { yield { type: "text_delta", text: "I can't answer questions yet: no model key is configured on this Ripple server." } as const; })();
      return runInteractive({ model, question, g, now: Math.floor(Date.now() / 1000), viewer });
    },
  };
}
