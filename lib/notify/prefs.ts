// Notification preferences: person over org default over system default. Implements PrefsReader for route().
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { orgNotifyDefaults, preferences, type ChannelPrefs } from "../db/schema";
import type { Prefs, PrefsReader, Urgency } from "./types";

export const URGENCIES: Urgency[] = ["high", "normal", "low"];
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** One layer of prefs (a person's row, the org default, or the system default). Unset fields inherit. */
export type Layer = {
  channels?: ChannelPrefs | null;
  tz?: string | null;
  quietStart?: string | null;
  quietEnd?: string | null;
  digest?: boolean | null;
  digestDay?: string | null; // mon..sun or 'off'
};

/** What a person gets when nobody has chosen anything. Matches route()'s built-in channels. */
export const SYSTEM_DEFAULTS = {
  channels: { high: ["slack_dm", "email", "inbox"], normal: ["slack_dm", "inbox"], low: ["inbox"] },
  tz: "UTC",
  quietStart: null,
  quietEnd: null,
  digest: true,
  digestDay: "mon",
} satisfies Layer;

/** First layer that sets a field wins; channels are merged per urgency, quiet hours as a start/end pair. */
export function merge(...layers: (Layer | null | undefined)[]): Layer {
  const ls = layers.filter((l): l is Layer => !!l);
  const first = <K extends keyof Layer>(k: K) => ls.find((l) => l[k] != null)?.[k];
  const channels: ChannelPrefs = {};
  for (const u of URGENCIES) {
    const c = ls.find((l) => l.channels?.[u])?.channels?.[u];
    if (c) channels[u] = c;
  }
  const q = ls.find((l) => l.quietStart != null && l.quietEnd != null);
  return {
    channels, tz: first("tz"), quietStart: q?.quietStart, quietEnd: q?.quietEnd,
    digest: first("digest"), digestDay: first("digestDay"),
  };
}

/** Effective settings, system defaults included. What the settings page shows. */
export const effective = (person?: Layer | null, org?: Layer | null) => merge(person, org, SYSTEM_DEFAULTS);

/** The slice route() reads. System defaults are left out on purpose: route() already has them. */
export function toPrefs(person?: Layer | null, org?: Layer | null): Prefs {
  const m = merge(person, org);
  const digest = person?.digest ?? (org?.digestDay ? org.digestDay !== "off" : undefined);
  return {
    ...(Object.keys(m.channels ?? {}).length && { channels: m.channels as Prefs["channels"] }),
    ...(m.quietStart && m.quietEnd && { quietHours: { start: m.quietStart, end: m.quietEnd, tz: m.tz ?? SYSTEM_DEFAULTS.tz } }),
    ...(digest !== undefined && { digest }),
  };
}

type PersonRow = Layer & { personId: string | null };

/** A synchronous snapshot, as route() needs it. Build once per batch of events. */
export function snapshotReader(rows: PersonRow[], org?: Layer | null): PrefsReader {
  const byPerson = new Map(rows.filter((r) => r.personId).map((r) => [r.personId as string, r]));
  return { get: (personId) => toPrefs(byPerson.get(personId), org) };
}

export async function loadOrgDefault(orgId: string, d = db()): Promise<Layer | null> {
  return (await d.select().from(orgNotifyDefaults).where(eq(orgNotifyDefaults.orgId, orgId)))[0] ?? null;
}

const orgRows = (orgId: string, d = db()) => d.select().from(preferences).where(eq(preferences.orgId, orgId));

export async function loadPersonLayer(orgId: string, userId: string, d = db()): Promise<Layer | null> {
  return (await orgRows(orgId, d)).find((r) => r.userId === userId) ?? null;
}

/** Preloaded reader for every person in the org: one query for rows, one for the default. */
export async function loadPrefsReader(orgId: string, d = db()): Promise<PrefsReader> {
  const [rows, org] = await Promise.all([orgRows(orgId, d), loadOrgDefault(orgId, d)]);
  return snapshotReader(rows, org);
}

/** Effective settings for one person: their row over the org default over the system default. */
export async function prefsFor(orgId: string, personId: string, d = db()): Promise<Layer> {
  const [rows, org] = await Promise.all([orgRows(orgId, d), loadOrgDefault(orgId, d)]);
  return effective(rows.find((r) => r.personId === personId), org);
}

export async function savePersonPrefs(orgId: string, userId: string, personId: string | null | undefined, v: Layer, d = db()) {
  const set = { personId: personId ?? null, tz: v.tz ?? null, quietStart: v.quietStart ?? null, quietEnd: v.quietEnd ?? null, channels: v.channels ?? null, digest: v.digest ?? null, updatedAt: new Date() };
  await d.insert(preferences).values({ orgId, userId, ...set }).onConflictDoUpdate({ target: [preferences.orgId, preferences.userId], set });
}

export async function saveOrgDefault(orgId: string, v: Layer, d = db()) {
  const set = { tz: v.tz ?? null, quietStart: v.quietStart ?? null, quietEnd: v.quietEnd ?? null, channels: v.channels ?? null, digestDay: v.digestDay ?? null, updatedAt: new Date() };
  await d.insert(orgNotifyDefaults).values({ orgId, ...set }).onConflictDoUpdate({ target: orgNotifyDefaults.orgId, set });
}
