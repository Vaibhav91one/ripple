import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const emit = vi.fn(async () => undefined);
const runBackground = vi.fn();
vi.mock("../lib/agent/runtime", () => ({ runBackground }));
vi.mock("../lib/events/emit", () => ({ emit }));
vi.mock("../lib/db", () => ({ db: () => ({ select: () => ({ from: () => ({ where: async () => [{ id: "o1", graphName: "g" }] }) }) }) }));
vi.mock("../lib/db/schema", () => ({ orgs: {} }));
vi.mock("../lib/graph/client", () => ({ graphFor: async () => ({}) }));
vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));

const job = { data: { orgId: "o1", agent: "impact", input: { reason: "change.confirmed", decisionId: "d-1", contractId: null } } };

describe("agent worker handler (#211)", () => {
  beforeEach(() => { emit.mockClear(); runBackground.mockReset(); });

  it("emits impact.ready for a run that finished", async () => {
    runBackground.mockResolvedValue({ runId: "r1", status: "done", tokens: 1 });
    await (await import("./handlers/agent")).default([job] as never);
    expect(emit).toHaveBeenCalledOnce();
  });

  it("emits no impact.ready for a rejected run (an invented teamId)", async () => {
    runBackground.mockResolvedValue({ runId: "r2", status: "rejected", tokens: 1, error: "rejected: output names ids no tool returned (teamId=finance)" });
    await (await import("./handlers/agent")).default([job] as never);
    expect(emit).not.toHaveBeenCalled();
  });
});
