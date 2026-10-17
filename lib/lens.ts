// The demo's "view as" lens: a cookie that picks which team the anonymous demo viewer is looking from.
export const LENS_COOKIE = "ripple_lens";
export const LENSES = ["legal", "sales", "security", "leadership", "change-owner"] as const;
export type Lens = (typeof LENSES)[number];
export const DEFAULT_LENS: Lens = "change-owner";
/** The change owner sits in Engineering; the others map to the team of the same name. */
export const LENS_TEAM: Record<Lens, string> = { legal: "legal", sales: "sales", security: "security", leadership: "leadership", "change-owner": "eng" };

/** The anonymous demo viewer reads the inbox as this person of the lens team (the change owner is Priya, as the old inbox did). */
export const TEAM_PERSON: Record<string, string> = {
  eng: "p-priya", legal: "p-mei", sales: "p-dee", security: "p-tara", leadership: "p-jon", support: "p-ana", devrel: "p-maya",
};

/** Anything off the allowlist is the default lens. */
export const parseLens = (v: string | undefined | null): Lens => LENSES.find((l) => l === v) ?? DEFAULT_LENS;
