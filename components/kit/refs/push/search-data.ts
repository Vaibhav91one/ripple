// Ripple search groups: real ids from lib/mock/ledgerly.ts.
import type { SearchGroup } from "./MixedSearch";

export const mixedSearchDemoGroups: SearchGroup[] = [
  { label: "Decisions", rows: [{ id: "d-1", label: "Sunset API v1", icon: "gavel", tone: "ripple", meta: "d-1" }] },
  { label: "Systems", rows: [
    { id: "api-v1", label: "api-v1", icon: "server", tone: "ripple" },
    { id: "auth-service", label: "auth-service", icon: "key", tone: "ripple" },
  ] },
  { label: "Teams", rows: [
    { id: "legal", label: "Legal", icon: "scale", tone: "gap", meta: "not told" },
    { id: "data", label: "Data", icon: "database", tone: "gap", meta: "depth 4" },
  ] },
  { label: "Ask", rows: [{ id: "ask", label: "Who wasn't told about the v1 sunset?", icon: "sparkles", tone: "ripple" }] },
];
