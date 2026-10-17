// Eval sets by agent name. A new agent adds its set here (AGENTS.md: every agent has one, plus the injection set).
import { accessScenarios } from "./access/scenarios";
import { askScenarios } from "./ask/scenarios";
import { contractScenarios } from "./contract/scenarios";
import { exposureScenarios } from "./exposure/scenarios";
import { advisorScenarios } from "./advisor/scenarios";
import { docsScenarios } from "./docs/scenarios";
import { impactScenarios } from "./impact/scenarios";
import { securityScenarios } from "./security/scenarios";
import { supportScenarios } from "./support/scenarios";
import type { Scenario } from "./run";

export const EVAL_SETS: Record<string, Scenario[]> = {
  ask: askScenarios, impact: impactScenarios, contract: contractScenarios, exposure: exposureScenarios, access: accessScenarios,
  docs: docsScenarios, security: securityScenarios, support: supportScenarios, advisor: advisorScenarios,
};
