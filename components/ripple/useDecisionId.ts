"use client";

import { useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";

export const V1_DECISION_ID = "d-1";

/** Decision id: the `/changes/[id]` route param when present, else `?d=`, defaulting to the v1 sunset decision. */
export function useDecisionId() {
  const { id } = useParams<{ id?: string }>();
  const [d, setD] = useQueryState("d", parseAsString.withDefault(V1_DECISION_ID));
  return [id ?? d, setD] as const;
}
