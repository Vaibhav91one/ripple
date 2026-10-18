import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { agent as findAgent, agents } from "@/lib/agent/registry";
import { budgetLeft, spend, tokensLeft, visitorQuota, type Quota } from "@/lib/agent/limits";
import { runAgent } from "@/lib/agent/loop";
import { READ_TOOLS, type Ctx } from "@/lib/agent/tools";
import { sessionViewer } from "@/lib/auth";
import { cachedAnswer, tour } from "@/lib/assistant/cached";
import { sampleLoaded } from "@/lib/assistant/sample";
import { classify, helpChips, reply } from "@/lib/assistant/smalltalk";
import { env } from "@/lib/env";
import { pickModel } from "@/lib/llm";
import type { StreamEvent } from "@/lib/schemas";
import { getContext } from "@/lib/server/context";

// Multi-turn assistant chat. Same SSE StreamEvent frames as /api/ask, plus a leading `meta` event (budget left, where the thread lives).
// Body: { messages: [{role, content}, ...] (last is the new user message), agent?: string, conversationId?: string }
// "@agent question" in the last message routes to that agent as well; the `agent` param wins.

const Msg = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) });
const Body = z.object({
  messages: z.array(Msg).min(1).max(40).refine((m) => m.at(-1)?.role === "user", "the last message must be from the user"),
  agent: z.string().max(40).optional(),
  conversationId: z.string().max(64).optional(),
});

const VID = "ripple_vid";
const CHAT_RULES = `\nYou are answering in a chat. Answer only from tool results. After every factual claim cite the supporting artifact as [[artifact-id]] using ONLY ids returned by tools this turn. If the tools return nothing relevant, say Ripple hasn't learned about it yet and where it could come from (a repo, a Slack channel, a CSV). Never write ids or ISO dates. Be concise.`;

const sign = (id: string) => createHmac("sha256", env().ACK_TOKEN_SECRET ?? "ripple-dev-visitor").update(id).digest("base64url");
/** Visitor = signed cookie + trusted client IP (the right-most x-forwarded-for hop is the one our proxy appended; x-real-ip otherwise; null when neither, so unknown IPs never share one key). */
function visitorOf(req: Request) {
  const xff = req.headers.get("x-forwarded-for")?.split(",").map((x) => x.trim()).filter(Boolean).at(-1);
  const ip = xff || req.headers.get("x-real-ip") || null;
  const [id, mac] = req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${VID}=([\\w-]+)\\.([\\w-]+)`))?.slice(1) ?? [];
  const ok = !!id && !!mac && mac.length === sign(id).length && timingSafeEqual(Buffer.from(mac), Buffer.from(sign(id)));
  const cookie = ok ? id : crypto.randomUUID();
  return { ip, cookie, isNew: !ok, value: `${cookie}.${sign(cookie)}` };
}

const HISTORY_CHARS = 12_000;
/** Newest turns that fit the budget; never starts on an assistant turn. */
function trimHistory<T extends { role: string; content: string }>(h: T[]): T[] {
  let n = 0;
  const keep: T[] = [];
  for (const m of [...h].reverse()) {
    n += m.content.length;
    if (n > HISTORY_CHARS) break;
    keep.unshift(m);
  }
  while (keep[0]?.role === "assistant") keep.shift();
  return keep;
}

/** `@name rest` -> the agent and the text without the mention. Unknown names stay plain text. */
function route(text: string, param?: string): { agent?: string; text: string } {
  const m = text.match(/^@([a-z0-9_-]+)\s+([\s\S]+)$/i);
  const named = m && findAgent(m[1].toLowerCase());
  if (param) return { agent: param.toLowerCase(), text: named ? m[2] : text };
  return named ? { agent: named.name, text: m[2] } : { text };
}

function proposer(ctx: Awaited<ReturnType<typeof getContext>>): Ctx["propose"] {
  if (ctx.readonly || ctx.viewer.kind !== "user" || !env().DATABASE_URL) return undefined;
  const pc = { org: ctx.org, viewer: { kind: "user" as const, id: ctx.viewer.userId } };
  return async (kind, payload, evidence) => (await import("@/lib/actions/propose")).propose(pc, kind, payload, evidence);
}

export async function POST(req: Request): Promise<Response> {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send {messages: [{role, content}], agent?, conversationId?}; the last message must be from the user." }, { status: 400 });
  const last = body.data.messages.at(-1)!;
  const routed = route(last.content, body.data.agent);
  const def = routed.agent ? findAgent(routed.agent) : undefined;
  if (routed.agent && !def) return Response.json({ error: `Unknown agent "${routed.agent}".`, agents: agents().map((a) => a.name) }, { status: 400 });
  const question = routed.text;
  const history = trimHistory(body.data.messages.slice(0, -1));

  const visitor = visitorOf(req);
  const ctx = await getContext(req).catch(() => null); // null (graph down): treated as the public demo
  const demo = !ctx || ctx.org.isDemo;
  const owner = !demo && ctx && ctx.viewer.kind === "user" && env().DATABASE_URL ? { orgId: ctx.org.id, userId: ctx.viewer.userId, graphName: ctx.org.graphName } : null;
  const store = owner ? await import("@/lib/assistant/store") : null;

  // --- decide cached / live / exhausted before streaming, so the first event can carry the budget. Quota, token cap and canned answers are the public demo's; real orgs (Clerk, local) are never limited or given canned answers. ---
  const talk = def ? undefined : classify(question); // "hi", "thanks", "what can you do?": a reply with no model, tools, citations or quota
  const model = talk ? null : pickModel("agent");
  // An org that loaded the Ledgerly sample and has no model key still gets the sample's starter answers: same data, same answer (#274).
  const sample = !talk && !demo && !model && ctx ? await sampleLoaded(ctx.org.graphName).catch(() => false) : false;
  const cached: StreamEvent[] | undefined = talk
    ? [{ type: "text_delta", text: reply(talk) }, { type: "suggestions", kind: "help", items: helpChips() }, { type: "done" }]
    : demo || sample ? cachedAnswer(question, def?.name) : undefined;
  let quota: Quota = { ok: true, remaining: null, limit: null };
  let exhausted = false;
  if (demo) quota = await visitorQuota(visitor, false);
  if (!cached && model && demo) {
    exhausted = !quota.ok || !(await tokensLeft()) || !budgetLeft();
    if (!exhausted) {
      quota = await visitorQuota(visitor, true); // only a live answer spends a prompt, atomically
      exhausted = !quota.ok;
    }
  }

  let convId = body.data.conversationId;
  if (store && owner) {
    if (convId) { if (!(await store.getConversation(owner, convId))) return Response.json({ error: "No such conversation." }, { status: 404 }); }
    else convId = (await store.createConversation(owner, question, def?.name)).id;
    await store.addMessage(owner, convId, { role: "user", content: last.content, agent: def?.name });
  }

  async function* events(): AsyncGenerator<StreamEvent> {
    yield { type: "meta", remaining: quota.remaining, limit: quota.limit, cached: !!cached || exhausted, exhausted, persist: !!store, conversationId: convId, agent: def?.name };
    if (cached) return yield* cached;
    if (exhausted) return yield* tour();
    if (!model) {
      yield { type: "text_delta", text: "I can only answer the suggested questions right now, because no AI model is connected to this server. Try one of these." };
      yield { type: "suggestions", kind: "help", items: helpChips() };
      return yield { type: "done" };
    }
    try {
      if (!ctx) throw new Error("the graph is not reachable");
      yield* runAgent({
        model, question, history, g: ctx.writer(), now: ctx.now, demo: ctx.org.isDemo, readonly: ctx.readonly, viewer: ctx.viewer,
        onUsage: spend, audit: ctx.audit, propose: proposer(ctx),
        ...(def && { system: def.system({ now: ctx.now }) + CHAT_RULES, toolNames: def.tools.filter((t) => READ_TOOLS.includes(t)) }),
      });
    } catch (e) {
      yield { type: "text_delta", text: `Chat failed: ${e instanceof Error ? e.message : String(e)}` };
      yield { type: "done" };
    }
  }

  const it = events();
  const enc = new TextEncoder();
  const seen: StreamEvent[] = [];
  const headers: Record<string, string> = { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform" };
  if (visitor.isNew) headers["set-cookie"] = `${VID}=${visitor.value}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`;
  return new Response(
    new ReadableStream({
      async pull(ctrl) {
        const n = await it.next();
        if (n.done) return ctrl.close();
        seen.push(n.value);
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify(n.value)}\n\n`));
        if (n.value.type === "done" && store && owner && convId) {
          const text = seen.filter((e) => e.type === "text_delta").map((e) => e.text).join("");
          try {
            await store.addMessage(owner, convId, { role: "assistant", content: text, events: seen.filter((e) => e.type !== "meta"), agent: def?.name });
          } catch (e) {
            console.error("chat: saving the reply failed:", e instanceof Error ? e.message : String(e)); // the answer already streamed
          }
        }
      },
      cancel: () => void it.return(undefined),
    }),
    { headers },
  );
}
