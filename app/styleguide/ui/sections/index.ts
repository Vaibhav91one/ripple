// Add a section to /styleguide/ui: create sections/<name>.tsx (default export = a component) and add one line here.
import type { ComponentType } from "react";
import StatsSection from "./stats";
import ChartsSection from "./charts";
import ExceptionSection from "./exception";
import AgentsSection from "./agents";

export type UiSection = { id: string; title: string; note: string; Component: ComponentType };

export const sections: UiSection[] = [
  { id: "stats", title: "Numbers", note: "Headline figures: summary line, stat cards, big stats, big figure.", Component: StatsSection },
  { id: "charts", title: "Charts", note: "Waterfall, weekly bars, stepped bars.", Component: ChartsSection },
  { id: "exception", title: "One exception", note: "Status strip, evidence diff, explanation, resolve options, severity panel, toast.", Component: ExceptionSection },
  { id: "agents", title: "Agents and asking", note: "Agent card, pattern card, needs you, inline ask, trust checklist, change drawer, search, timeline.", Component: AgentsSection },
];
