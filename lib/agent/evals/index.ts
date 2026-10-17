// Eval sets by agent name. A new agent adds its set here (AGENTS.md: every agent has one, plus the injection set).
import { askScenarios } from "./ask/scenarios";
import type { Scenario } from "./run";

export const EVAL_SETS: Record<string, Scenario[]> = { ask: askScenarios };
