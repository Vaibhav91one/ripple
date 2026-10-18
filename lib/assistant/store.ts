// Conversation persistence for signed-in orgs (Postgres). The public demo never calls this.
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { conversations, messages } from "../db/schema";
import type { StreamEvent } from "../schemas";

export type Owner = { orgId: string; userId: string };
const mine = (o: Owner, id: string) => and(eq(conversations.id, id), eq(conversations.orgId, o.orgId), eq(conversations.userId, o.userId));
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const listConversations = (o: Owner) =>
  db().select().from(conversations).where(and(eq(conversations.orgId, o.orgId), eq(conversations.userId, o.userId))).orderBy(desc(conversations.updatedAt)).limit(100);

export async function getConversation(o: Owner, id: string) {
  if (!isUuid(id)) return null;
  const [c] = await db().select().from(conversations).where(mine(o, id));
  if (!c) return null;
  return { ...c, messages: await db().select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt) };
}

export const createConversation = async (o: Owner, title: string, agent?: string) =>
  (await db().insert(conversations).values({ ...o, title: title.slice(0, 80), agent: agent ?? null }).returning())[0];

export async function renameConversation(o: Owner, id: string, title: string) {
  if (!isUuid(id)) return null;
  const [c] = await db().update(conversations).set({ title: title.slice(0, 80), updatedAt: new Date() }).where(mine(o, id)).returning();
  return c ?? null;
}

export async function deleteConversation(o: Owner, id: string) {
  if (!isUuid(id)) return false;
  return (await db().delete(conversations).where(mine(o, id)).returning({ id: conversations.id })).length > 0;
}

/** Append one message and touch the thread. Returns false when the thread is not the caller's. */
export async function addMessage(o: Owner, id: string, m: { role: "user" | "assistant"; content: string; events?: StreamEvent[]; agent?: string }) {
  if (!isUuid(id) || !(await db().select({ id: conversations.id }).from(conversations).where(mine(o, id))).length) return false;
  await db().insert(messages).values({ conversationId: id, role: m.role, content: m.content, events: m.events ?? null, agent: m.agent ?? null });
  await db().update(conversations).set({ updatedAt: new Date() }).where(mine(o, id));
  return true;
}
