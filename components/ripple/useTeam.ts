"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

export const TEAM_TABS = [
  { id: "eng", label: "Eng" },
  { id: "support", label: "Support" },
  { id: "sales", label: "Sales" },
  { id: "legal", label: "Legal" },
  { id: "security", label: "Security" },
  { id: "devrel", label: "DevRel" },
] as const;

/** `?team=` filter; null means All. */
export const useTeam = () => useQueryState("team", parseAsStringLiteral(TEAM_TABS.map((t) => t.id)));
