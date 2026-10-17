import { z } from "zod";
import { allow, budgetLeft, spend } from "@/lib/agent/limits";
import { runAgent } from "@/lib/agent/loop";
import { pickModel } from "@/lib/llm";
import { askEvents, askQuestion } from "@/lib/mock/ledgerly";
import type { StreamEvent } from "@/lib/schemas";
import type { Ctx } from "@/lib/agent/tools";
import { env } from "@/lib/env";
import { getContext } from "@/lib/server/context";

// Node runtime is the default; `export const runtime` is rejected with cacheComponents.

const Body = z.object({ question: z.string().trim().min(1).max(500) });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

/** Cached answer for the demo question, otherwise a "no model" notice. */
function* fallback(question: string, reason: string): Generator<StreamEvent> {
  if (norm(question) === norm(askQuestion)) yield* askEvents;
  else {
    yield { type: "text_delta", text: `${reason} Try the demo question: "${askQuestion}"` };
    yield { type: "done" };
  }
}

/** Signed-in org with Postgres: tools propose actions for approval. Everyone else gets none (write tools only describe). */
function proposer(ctx: Awaited<ReturnType<typeof getContext>>): Ctx["propose"] {
  if (ctx.readonly || ctx.viewer.kind !== "user" || !env().DATABASE_URL) return undefined;
  const pc = { org: ctx.org, viewer: { kind: "user", id: ctx.viewer.userId } };
  return async (kind, payload, evidence) => (await import("@/lib/actions/propose")).propose(pc, kind, payload, evidence);
}

async function* answer(question: string, req: Request): AsyncGenerator<StreamEvent> {
  const model = pickModel("agent");
  if (!model) return yield* fallback(question, "No model key is configured on this server.");
  if (!budgetLeft()) return yield* fallback(question, "The daily token budget is used up.");
  try {
    const ctx = await getContext(req);
    // the agent has write tools (create_tasks, ack_brief) on the demo org, so it gets the writable graph
    yield* runAgent({ model, question, g: ctx.writer(), now: ctx.now, demo: ctx.org.isDemo, readonly: ctx.readonly, viewer: ctx.viewer, onUsage: spend, audit: ctx.audit, propose: proposer(ctx) });
  } catch (e) {
    yield { type: "text_delta", text: `Ask failed: ${e instanceof Error ? e.message : String(e)}` };
    yield { type: "done" };
  }
}

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  if (!allow(ip)) return Response.json({ error: "Rate limit: 20 questions per hour." }, { status: 429 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send {question: string}." }, { status: 400 });

  const events = answer(body.data.question, req);
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      async pull(ctrl) {
        const n = await events.next();
        if (n.done) ctrl.close();
        else ctrl.enqueue(enc.encode(`data: ${JSON.stringify(n.value)}\n\n`));
      },
      cancel: () => void events.return(undefined),
    }),
    { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform" } },
  );
}
