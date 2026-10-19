import { describe, expect, it } from "vitest";
import { redact, type Index } from "./permissions/redact";
import { RESTRICTED_TITLE } from "./permissions/classify";
import { SearchResult, fulltextQuery, groupHits, highlight, hrefFor, matchScore, rank, type Group } from "./search";

const h = (id: string, group: Group, title: string, score = 0) => ({ id, group, title, label: group, score });

describe("ranking", () => {
  it("orders exact > prefix > word prefix > substring and drops non-matches", () => {
    expect(matchScore("v1", "v1")).toBe(100);
    expect(matchScore("v1 sunset", "v1")).toBe(80);
    expect(matchScore("Sunset API v1 on Jan 31", "v1")).toBe(60);
    expect(matchScore("apiv1", "v1")).toBe(40);
    expect(matchScore("Sunset API v1", "sunset v1")).toBe(30);
    expect(matchScore("Northwind", "acme")).toBe(0);
    const out = rank([h("a", "system", "apiv1"), h("b", "change", "Sunset API v1 on Jan 31"), h("c", "system", "nope"), h("d", "customer", "v1")], "v1");
    expect(out.map((x) => x.id)).toEqual(["d", "b", "a"]);
  });

  it("keeps full-text hits whose title does not match, dedupes and caps per group and overall", () => {
    expect(rank([h("t", "ticket", "Customer outage", 3)], "v1").map((x) => x.id)).toEqual(["t"]);
    const many = Array.from({ length: 9 }, (_, i) => h(`s${i}`, "system", `v1 thing ${i}`));
    expect(rank([...many, many[0]], "v1", 5)).toHaveLength(5);
    expect(rank(many, "v1", 9, 3)).toHaveLength(3);
  });

  it("groups in display order", () => {
    const g = groupHits([h("p", "person", "Ana"), h("c", "change", "v1"), h("s", "system", "api-v1")]);
    expect(g.map((x) => x.group)).toEqual(["change", "system", "person"]);
  });

  it("highlights the first match and builds safe full-text queries", () => {
    expect(highlight("Sunset API v1", "api")).toEqual([{ text: "Sunset ", hit: false }, { text: "API", hit: true }, { text: " v1", hit: false }]);
    expect(highlight("abc", "z")).toEqual([{ text: "abc", hit: false }]);
    expect(fulltextQuery("v1 (sunset)!")).toBe("v1* sunset*");
    expect(fulltextQuery("a | -")).toBeNull();
  });

  it("links each kind to a real place", () => {
    expect(hrefFor({ id: "d-1", group: "change" })).toBe("/reports/d-1");
    expect(hrefFor({ id: "api-v1", group: "system", title: "API v1" })).toBe("/graph?q=API%20v1");
    expect(hrefFor({ id: "impact", group: "agent" })).toBe("/agents#impact");
    expect(hrefFor({ id: "legal", group: "team" })).toBe("/agents?team=legal");
    expect(hrefFor({ id: "eng", group: "team" })).toBe("/teams/eng");
    expect(hrefFor({ id: "t-1", group: "ticket", kind: "ticket" })).toBe("/items/ticket/t-1");
    expect(hrefFor({ id: "ctr-1", group: "contract" })).toBe("/items/contract/ctr-1");
  });
});

describe("redaction", () => {
  const idx: Index = { ids: new Map([["ctr-1", { kind: "contract", owner: "legal" }]]), artifacts: new Map([["art-msa", "legal"]]) };
  const raw = {
    hits: [
      { id: "ctr-1", group: "contract", label: "Contract", title: "Northwind MSA SECRET", text: "SECRET", score: 0 },
      { id: "art-msa", group: "document", label: "Document", kind: "doc", title: "Northwind MSA SECRET.pdf", score: 2 },
      { id: "cust-1", group: "customer", label: "Customer", title: "Northwind", score: 0 },
    ],
  };
  const parse = (teamIds: string[]) => SearchResult.parse(redact(raw, { teamIds }, idx).value);

  it("a non-owner sees restricted stubs with no name, in the title, sub or href", () => {
    const r = parse(["eng"]);
    expect(JSON.stringify(r)).not.toContain("SECRET");
    expect(r.hits).toHaveLength(3);
    const [contract, doc, cust] = r.hits;
    expect(contract).toMatchObject({ restricted: true, title: "Contract (restricted)", href: "/items/contract/ctr-1" });
    expect(doc).toMatchObject({ restricted: true, sub: "Restricted to Legal" });
    expect(doc.title).not.toBe(RESTRICTED_TITLE);
    expect(cust).toMatchObject({ restricted: false, title: "Northwind", href: "/graph?q=Northwind" });
  });

  it("the owner sees the names", () => {
    const r = parse(["legal"]);
    expect(r.hits[0]).toMatchObject({ restricted: false, title: "Northwind MSA SECRET" });
    expect(r.hits[1]).toMatchObject({ restricted: false, title: "Northwind MSA SECRET.pdf", href: "/items/doc/art-msa" });
  });
});

describe("ties", () => {
  it("ranks an open change above a closed one, then the newer one first", () => {
    const c = (id: string, live: boolean, at: number) => ({ ...h(id, "change", "Sunset API v1 on Jan 31"), live, at });
    const out = rank([c("old-closed", false, 1), c("old-open", true, 1), c("new-open", true, 9), c("new-closed", false, 9)], "v1");
    expect(out.map((x) => x.id)).toEqual(["new-open", "old-open", "new-closed", "old-closed"]);
  });
});
