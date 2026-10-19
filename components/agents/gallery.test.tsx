import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { agents } from "@/lib/agent/registry";
import type { AgentInfo } from "@/lib/schemas";
import { AGENT_ART } from "./art";
import { agentStatus, AgentGrid, filterAgents, isTeamFilter, parseTeam, runTone, runWords } from "./gallery";

const info = (a: ReturnType<typeof agents>[number], over: Partial<AgentInfo> = {}): AgentInfo => ({
  name: a.name, displayName: a.displayName, tagline: a.tagline, group: a.group, job: "", team: a.team, triggers: [], tools: [], writes: [],
  enabled: true, autoApprove: {}, lastRun: null, runs24h: 0, ...over,
});
const all = agents().map((a) => info(a));
const render = (list: AgentInfo[]) => renderToStaticMarkup(createElement(AgentGrid, { agents: list, now: 0, lock: "Read-only demo", busy: null, onOpen: () => {}, onToggle: () => {} }));

describe("agent meta", () => {
  it("every registered agent has a display name, tagline, team and illustration", () => {
    expect(all).toHaveLength(12);
    for (const a of agents()) {
      expect(a.displayName.trim(), a.name).not.toBe("");
      expect(a.displayName, a.name).not.toBe(a.name);
      expect(a.tagline.length, a.name).toBeGreaterThan(20);
      expect(a.tagline.length, a.name).toBeLessThan(90);
      expect(a.team, a.name).not.toBe("");
      expect(typeof AGENT_ART[a.name], a.name).toBe("function");
    }
  });

  it("illustrations use token colours only, with no gradients, filters or text", () => {
    const dir = join(__dirname, "art");
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(/#[0-9a-f]{3,8}\b|oklch\(|rgba?\(|hsla?\(|Gradient|<filter|<text/i);
    }
  });
});

describe("gallery filter", () => {
  it("filters by team from the URL, with change-owner agents under Everyone", () => {
    expect(isTeamFilter("legal")).toBe(true);
    expect(isTeamFilter("eng")).toBe(false);
    expect(filterAgents(all, "", "legal").map((a) => a.name)).toEqual(["contract"]);
    expect(filterAgents(all, "", "everyone").map((a) => a.name)).toEqual(["impact", "ask", "comms", "courier", "digest"]);
    expect(filterAgents(all, "", null)).toHaveLength(12);
  });

  it("searches name, tagline and team label, all words must match", () => {
    expect(filterAgents(all, "sentinel", null).map((a) => a.name)).toEqual(["contract"]);
    expect(filterAgents(all, "TICKETS", null).map((a) => a.name)).toEqual(["support"]);
    expect(filterAgents(all, "devrel", null).map((a) => a.name)).toEqual(["docs"]);
    expect(filterAgents(all, "docs zzz", null)).toEqual([]);
    expect(filterAgents(all, "risk", "legal")).toEqual([]);
  });

  it("renders display names, never raw ids, and only the filtered cards", () => {
    const html = render(filterAgents(all, "", "security"));
    expect(html).toContain("Security Reviewer");
    expect(html).not.toContain("Contract Sentinel");
    expect(html).not.toMatch(/>security</);
    expect(html).toContain('href="/?agent=security"');
    expect(html).toContain('title="Read-only demo"');
    expect(html).toContain("disabled");
  });

  it("reads ?team= case-insensitively and flags unknown teams", () => {
    expect(parseTeam("Legal")).toEqual({ team: "legal", unknown: false });
    expect(parseTeam("eng")).toEqual({ team: null, unknown: true });
    expect(parseTeam(null)).toEqual({ team: null, unknown: false });
  });

  it("one status rule: neutral idle, amber for over budget and recent failures only", () => {
    const H = 3_600_000, now = 10 * 24 * H, run = (status: string, hAgo: number) => ({ id: "r", status, startedAt: new Date(now - hAgo * H).toISOString() });
    expect(agentStatus({ enabled: true, lastRun: null }, now).tone).toBe("neutral");
    expect(agentStatus({ enabled: true, lastRun: run("done", 1) }, now).tone).toBe("neutral");
    expect(agentStatus({ enabled: false, lastRun: run("failed", 1) }, now)).toEqual({ tone: "neutral", label: "Off" });
    expect(agentStatus({ enabled: true, lastRun: run("failed", 2) }, now)).toEqual({ tone: "gap", label: "Needs a look" });
    expect(agentStatus({ enabled: true, lastRun: run("failed", 72) }, now)).toEqual({ tone: "neutral", label: "Last run failed 3d ago" });
    expect(agentStatus({ enabled: true, lastRun: run("budget", 200) }, now)).toEqual({ tone: "gap", label: "Over budget" });
    expect(runTone("budget", run("budget", 200).startedAt, now)).toBe("gap");
    expect(runTone("failed", run("failed", 30).startedAt, now)).toBe("neutral");
    expect(runTone("running", run("running", 0).startedAt, now)).toBe("ripple");
    expect(runWords({ lastRun: null, runs24h: 0 }, 0)).toBe("Hasn't run yet · no runs in the last day");
    expect(runWords({ lastRun: { id: "r", status: "done", startedAt: new Date(0).toISOString() }, runs24h: 3 }, 7_200_000)).toBe("Last ran 2h ago · 3 runs in the last day");
  });
});
