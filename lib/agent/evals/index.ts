// Eval sets by agent name. A new agent adds its set here (AGENTS.md: every agent has one, plus the injection set).
import { accessScenarios } from "./access/scenarios";
import { askScenarios } from "./ask/scenarios";
import { commsScenarios } from "./comms/scenarios";
import { courierScenarios } from "./courier/scenarios";
import { contractScenarios } from "./contract/scenarios";
import { digestScenarios } from "./digest/scenarios";
import { exposureScenarios } from "./exposure/scenarios";
import { advisorScenarios } from "./advisor/scenarios";
import { docsScenarios } from "./docs/scenarios";
import { impactScenarios } from "./impact/scenarios";
import { securityScenarios } from "./security/scenarios";
import { supportScenarios } from "./support/scenarios";
import { agent } from "../registry";
import type { Scenario } from "./run";

/** Memory (#210): every recorded trace of an agent with recall opens with the recall call a good run makes first (ids from the input),
 *  so the runner's "recall first" check passes offline; live runs get no such help. The memory scenarios in evals.test.ts write their own traces. */
const withRecall = (name: string, set: Scenario[]): Scenario[] => {
  if (!agent(name)?.tools.includes("recall")) return set;
  return set.map((s) => {
    const first = s.trace?.calls[0]?.[0];
    if (!s.trace || first?.tool === "recall") return s;
    const ids = Object.values((s.input ?? {}) as Record<string, unknown>).filter((v): v is string => typeof v === "string" && /^[\w-]+$/.test(v));
    return { ...s, expect: { ...s.expect, maxSteps: s.expect.maxSteps + 1 }, trace: { ...s.trace, calls: [[{ tool: "recall", input: { entityIds: ids } }], ...s.trace.calls] } };
  });
};

const SETS: Record<string, Scenario[]> = {
  ask: askScenarios, impact: impactScenarios, contract: contractScenarios, exposure: exposureScenarios, access: accessScenarios, digest: digestScenarios,
  docs: docsScenarios, security: securityScenarios, support: supportScenarios, advisor: advisorScenarios,
  comms: commsScenarios, courier: courierScenarios,
};

export const EVAL_SETS: Record<string, Scenario[]> = Object.fromEntries(Object.entries(SETS).map(([n, set]) => [n, withRecall(n, set)]));
