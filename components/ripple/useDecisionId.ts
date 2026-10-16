"use client";

import { parseAsString, useQueryState } from "nuqs";

export const V1_DECISION_ID = "d-1";

/** `?d=` decision id, defaulting to the v1 sunset decision. */
export const useDecisionId = () => useQueryState("d", parseAsString.withDefault(V1_DECISION_ID));
