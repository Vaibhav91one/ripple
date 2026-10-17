import { afterAll, beforeAll, expect, it } from "vitest";
import { closeClient } from "@/lib/graph/client";

beforeAll(() => {
  process.env.FALKORDB_PORT = "59999"; // nothing listens here
});
afterAll(() => closeClient().catch(() => {}));

it("every route answers 503 {error:'graph_down'} when FalkorDB is unreachable", async () => {
  const urls: [string, string][] = [
    ["decisions", "/api/decisions"], ["ripple", "/api/ripple?d=d-1"], ["changes", "/api/changes?since=0"],
    ["bottleneck", "/api/bottleneck"], ["inbox", "/api/inbox?p=p-priya"], ["who-knows", "/api/who-knows?system=api-v1"],
    ["people", "/api/people"], ["names", "/api/names"], ["overview", "/api/overview"],
  ];
  for (const [route, url] of urls) {
    const res = await (await import(`./${route}/route`)).GET(new Request(`http://t${url}`));
    expect(res.status, url).toBe(503);
    expect(await res.json()).toEqual({ error: "graph_down" });
  }
  const teamRoute = await import("./teams/[team]/route");
  const tres = await teamRoute.GET(new Request("http://t/api/teams/eng"), { params: Promise.resolve({ team: "eng" }) });
  expect(tres.status).toBe(503);
  expect((await teamRoute.GET(new Request("http://t/api/teams/nope"), { params: Promise.resolve({ team: "nope" }) })).status).toBe(404);
  const items = await import("./items/[kind]/[id]/route");
  expect((await items.GET(new Request("http://t/api/items/team/eng"), { params: Promise.resolve({ kind: "team", id: "eng" }) })).status).toBe(503);
  const { GET } = await import("./source/[id]/route");
  const res = await GET(new Request("http://t/api/source/x"), { params: Promise.resolve({ id: "x" }) });
  expect(res.status).toBe(503);
});
