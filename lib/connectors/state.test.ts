import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { NONE, STATE_LABEL, STATE_TONE, summarize } = await import("./state");

const row = (kind: string, status: string, label: string | null, at: string | null = null, id = `${kind}-${status}`) => ({ id, kind, status, label, lastSyncAt: at });

describe("connectionState summarize", () => {
  it("no rows is none, with no label and the neutral 'Not connected' pill", () => {
    const c = summarize("github", []);
    expect(c).toEqual({ kind: "github", state: "none", label: null, accountIds: [], lastSyncAt: null });
    expect([STATE_LABEL[c.state], STATE_TONE[c.state]]).toEqual(["Not connected", "neutral"]);
    expect(NONE.slack.state).toBe("none");
  });
  it("an active row is connected (green) with its account label and last sync", () => {
    const c = summarize("github", [row("github", "active", "Vaibhav91one", "2026-10-18T10:00:00Z"), row("slack", "active", "New Workspace")]);
    expect(c).toMatchObject({ state: "connected", label: "Vaibhav91one", accountIds: ["github-active"], lastSyncAt: "2026-10-18T10:00:00.000Z" });
    expect([STATE_LABEL.connected, STATE_TONE.connected]).toEqual(["Connected", "covered"]);
    expect(summarize("slack", [row("slack", "active", "New Workspace")]).label).toBe("New Workspace");
  });
  it("a row whose sync failed is error, not connected", () => {
    const c = summarize("github", [row("github", "error", "acme")]);
    expect(c.state).toBe("error");
    expect(STATE_TONE.error).toBe("conflict");
  });
  it("any other status asks for a reconnect", () => {
    expect(summarize("slack", [row("slack", "revoked", null)]).state).toBe("needs_reauth");
    expect(STATE_TONE.needs_reauth).toBe("gap");
  });
  it("one active installation wins over a broken one; labels are de-duplicated and joined", () => {
    const c = summarize("github", [row("github", "error", "old", null, "a"), row("github", "active", "acme", null, "b"), row("github", "active", "acme", null, "c")]);
    expect(c).toMatchObject({ state: "connected", label: "acme", accountIds: ["b", "c"] });
  });
});
