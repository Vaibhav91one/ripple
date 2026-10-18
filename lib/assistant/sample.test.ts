// #274: "Load the sample company" seeds the Ledgerly data into one org's own graph only, idempotently, and removes only what it added.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { nodeCount } from "../graph/bootstrap";
import { closeClient, graphFor, query, roQuery } from "../graph/client";
import { orgHome } from "./home";
import { loadSample, removeSample, sampleLoaded } from "./sample";
import { starterChips } from "./smalltalk";
import { STARTER_PROMPTS } from "./prompts";

const org = `t_test274_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const demoState = async () => {
  const g = await graphFor("demo");
  const [n] = await roQuery<{ n: number }>(g, "MATCH (n) RETURN count(n) AS n").catch(() => [{ n: -1 }]);
  const [s] = await roQuery<{ at: number }>(g, "MATCH (s:SeedInfo) RETURN s.at AS at").catch(() => [{ at: -1 }]);
  return { n: n?.n, at: s?.at };
};

afterAll(async () => {
  await (await graphFor(org)).delete().catch(() => {});
  await closeClient();
});

describe("sample company", () => {
  it("refuses the shared demo graph and any non-org graph", async () => {
    await expect(loadSample("demo", 1)).rejects.toThrow(/org graph only/);
    await expect(removeSample("e2e_smoke")).rejects.toThrow(/org graph only/);
  });

  it("seeds only t_<orgId>, is idempotent, and removal keeps the org's own data", async () => {
    const demoBefore = await demoState();
    const g = await graphFor(org);
    await query(g, "CREATE (:System {id: 'gh:acme/web', name: 'acme/web'})"); // the org's own synced repo
    expect((await orgHome(g)).nodes).toBe(1);

    expect(await loadSample(org, 100)).toBe("loaded");
    expect(await sampleLoaded(org)).toBe(true);
    const n = await nodeCount(org);
    expect(n).toBeGreaterThan(50);
    expect(await loadSample(org, 200)).toBe("present"); // a second click is a no-op
    expect(await nodeCount(org)).toBe(n);
    expect((await roQuery(g, "MATCH (s:SeedInfo) RETURN s")).length).toBe(0); // an org graph never claims the demo seed version

    const home = await orgHome(g);
    expect(home.sample).toBe(true);
    expect(starterChips(home).map((c) => c.prompt)).toEqual([...STARTER_PROMPTS]); // the sample's starters are the cached ones

    expect(await removeSample(org)).toBe("removed");
    expect(await nodeCount(org)).toBe(1);
    expect((await roQuery<{ id: string }>(g, "MATCH (n:System) RETURN n.id AS id"))[0].id).toBe("gh:acme/web");
    expect(await removeSample(org)).toBe("absent");

    expect(await demoState()).toEqual(demoBefore); // the shared demo graph was never written
  }, 120_000);
});
