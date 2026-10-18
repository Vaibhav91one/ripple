import { describe, expect, it, vi } from "vitest";
import fixtures from "@/lib/schemas/fixtures/reports.json";
import { ReportDetail, ReportList, type ReportRow } from "@/lib/schemas/reports";
import { runChase, safeUrl, teamsWorstFirst, coverageAfter, day, gaps, isReadOnlyError, listSentence, matches, noticedSentence, relDays, STATE, usd, worstFirst } from "./reports-ui";

const detail = ReportDetail.parse(fixtures.detail);
const row = ReportList.parse(fixtures.list).cases[0];
const r = (p: Partial<ReportRow>): ReportRow => ({ ...row, ...p });

describe("reports formatting", () => {
  it("writes money short, with restricted ARR spelled out", () => {
    expect([usd(180000), usd(62500), usd(1_250_000), usd(640), usd(0), usd(-62000), usd(null)]).toEqual(["$180K", "$62.5K", "$1.3M", "$640", "$0", "-$62K", "Restricted"]);
  });

  it("dates are UTC and relative days read as words", () => {
    expect(day(1801386000)).toBe("Jan 31");
    const now = 1801386000;
    expect([relDays(now, now), relDays(now + 86400, now), relDays(now + 44 * 86400, now), relDays(now - 3 * 86400, now)]).toEqual(["today", "tomorrow", "in 44 days", "3 days ago"]);
  });

  it("the list sentence counts what needs you", () => {
    expect(listSentence(1, 1)).toBe("1 change on record. 1 needs you.");
    expect(listSentence(41, 3)).toBe("41 changes on record. 3 need you.");
    expect(listSentence(2, 0)).toBe("2 changes on record. Nothing needs you.");
  });
});

describe("reports state mapping", () => {
  it("sorts worst first: blocked, waiting, done, then lowest coverage", () => {
    const rows = [
      r({ id: "done", state: "done", coverage: { told: 5, affected: 5, pct: 100 } }),
      r({ id: "w80", state: "waiting", coverage: { told: 4, affected: 5, pct: 80 } }),
      r({ id: "w20", state: "waiting", coverage: { told: 1, affected: 5, pct: 20 } }),
      r({ id: "blk", state: "blocked" }),
    ];
    expect(worstFirst(rows).map((x) => x.id)).toEqual(["blk", "w20", "w80", "done"]);
    expect(STATE.blocked.tone).toBe("conflict");
  });

  it("search matches id, title, system and gap team", () => {
    expect(["api v1", "legal", "D-1", "sunset", ""].map((q) => matches(row, q))).toEqual([true, true, true, true, true]);
    expect(matches(row, "stripe")).toBe(false);
  });

  it("previews coverage once one more team is told", () => {
    expect(coverageAfter({ told: 2, affected: 5 })).toBe(60);
    expect(coverageAfter({ told: 5, affected: 5 })).toBe(100);
    expect(coverageAfter({ told: 0, affected: 0 })).toBe(100);
  });

  it("one gap card per open team, Legal first with the contract ARR", () => {
    const g = gaps(detail);
    expect(g.map((x) => x.name)).toEqual(["Legal", "Security", "DevRel"]);
    expect(g[0]).toMatchObject({ figure: "-$180K", action: "Chase Legal", after: 60 });
    expect(g[1]).toMatchObject({ figure: "+20 pts", action: "Chase Security" });
  });

  it("the noticed sentence comes from typed contract rows, and says so when they are redacted", () => {
    expect(noticedSentence(detail)).toBe("Northwind Capital MSA guarantees API v1 until Jun 30, 2027. The Jan 31 sunset breaks it. 1 more contract says the same. Nobody in Legal knows.");
    expect(noticedSentence({ ...detail, conflicts: detail.conflicts.map((c) => ({ ...c, contracts: [] })) })).toMatch(/restricted to its owning team/);
    expect(noticedSentence({ ...detail, conflicts: [] })).toBeNull();
  });

  it("Legal leads the gaps even when the contract rows are redacted", () => {
    const red = { ...detail, conflicts: detail.conflicts.map((c) => ({ ...c, contracts: [] })), teams: [...detail.teams].reverse() };
    expect(gaps(red)[0]).toMatchObject({ name: "Legal", figure: "+20 pts" });
    expect(teamsWorstFirst(detail.teams).map((t) => t.status)).toEqual(["not_told", "not_told", "not_told", "acked", "acked"]);
  });

  it("recognises the shared demo's read-only refusal", () => {
    expect(isReadOnlyError(new Error("demo_readonly"))).toBe(true);
    expect(isReadOnlyError(new Error("boom"))).toBe(false);
  });
});

describe("chase outcome", () => {
  const prop = (status: string) => async () => ({ id: "a1", status });
  const approved = vi.fn(async () => true);

  it("approves pending and failed rows, and says already when an earlier call did", async () => {
    expect(await runChase(prop("pending"), approved, true)).toBe("sent");
    expect(await runChase(prop("failed"), approved, true)).toBe("sent");
    expect(await runChase(prop("pending"), async () => false, true)).toBe("already");
    expect(await runChase(prop("approved"), approved, true)).toBe("already");
    expect(await runChase(prop("executed"), approved, true)).toBe("already");
    expect(approved).toHaveBeenCalledTimes(2);
  });

  it("leaves it proposed for a viewer who cannot decide, and errors on rejected or expired", async () => {
    const never = vi.fn(async () => true);
    expect(await runChase(prop("pending"), never, false)).toBe("proposed");
    expect(never).not.toHaveBeenCalled();
    await expect(runChase(prop("rejected"), never, true)).rejects.toThrow(/rejected earlier/);
    await expect(runChase(prop("expired"), never, true)).rejects.toThrow(/expired/);
  });

  it("links only http(s) urls", () => {
    expect([safeUrl("https://github.com/a/b/issues/1"), safeUrl("http://x.io"), safeUrl("javascript:alert(1)"), safeUrl("data:text/html,x"), safeUrl(null)]).toEqual(["https://github.com/a/b/issues/1", "http://x.io", null, null, null]);
  });
});
