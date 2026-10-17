// The demo's "view as" lens: a cookie that picks which team the anonymous demo viewer is looking from.
export const LENS_COOKIE = "ripple_lens";
export const LENSES = ["legal", "sales", "security", "leadership", "change-owner"] as const;
export type Lens = (typeof LENSES)[number];
export const DEFAULT_LENS: Lens = "change-owner";
/** The change owner sits in Engineering; the others map to the team of the same name. */
export const LENS_TEAM: Record<Lens, string> = { legal: "legal", sales: "sales", security: "security", leadership: "leadership", "change-owner": "eng" };

/** Anything off the allowlist is the default lens. */
export const parseLens = (v: string | undefined | null): Lens => LENSES.find((l) => l === v) ?? DEFAULT_LENS;
