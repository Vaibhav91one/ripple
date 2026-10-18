import { describe, expect, it } from "vitest";
import { auditHref, likePrefix, parseAuditFilter } from "./audit-view";

describe("audit log filters", () => {
  it("parses blank values as no filter and clamps the page", () => {
    expect(parseAuditFilter({})).toEqual({ actor: undefined, action: undefined, page: 1 });
    expect(parseAuditFilter({ actor: "  ", action: "", page: "0" })).toEqual({ actor: undefined, action: undefined, page: 1 });
    expect(parseAuditFilter({ page: "abc" }).page).toBe(1);
    expect(parseAuditFilter({ page: "99999" }).page).toBe(1000);
    expect(parseAuditFilter({ actor: [" agent ", "user"], action: "member.", page: "3" })).toEqual({ actor: "agent", action: "member.", page: 3 });
  });

  it("caps long input", () => {
    expect(parseAuditFilter({ action: "x".repeat(500) }).action).toHaveLength(120);
  });

  it("builds page links that keep the filters", () => {
    expect(auditHref({ page: 1 })).toBe("/settings#audit");
    expect(auditHref({ actor: "agent", action: "action.", page: 2 }, 3)).toBe("/settings?actor=agent&action=action.&page=3#audit");
    expect(auditHref({ action: "a b&c", page: 2 }, 1)).toBe("/settings?action=a+b%26c#audit");
  });

  it("matches an action prefix with LIKE wildcards taken literally", () => {
    expect(likePrefix("member.")).toBe("member.%");
    expect(likePrefix("100%_done\\")).toBe("100\\%\\_done\\\\%");
  });
});
