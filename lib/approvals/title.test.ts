import { describe, expect, it } from "vitest";
import { proposalTitle } from "./title";
import { SAMPLE_APPROVALS } from "./sample";

describe("proposalTitle", () => {
  it("writes sample proposals as sentences: no raw edge type, no raw id", () => {
    const names: Record<string, string> = { "cust-acme": "Acme", "api-v1": "API v1", billing: "Billing service", sso: "SSO" }; // what /api/names returns for the seeded graph
    const titles = SAMPLE_APPROVALS.approvals.map((r) => proposalTitle(r, (id) => names[id] ?? id));
    expect(titles[0]).toBe("Acme was promised API v1");
    for (const t of titles) expect(t).not.toMatch(/\b[A-Z]{4,}\b|[A-Z]_[A-Z]|\b(cust|sys)-[a-z0-9-]+|\bapi-v1\b/);
  });
});
