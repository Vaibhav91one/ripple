import type { AgentDef } from "./define";
import * as all from "./agents";

const list: readonly AgentDef[] = Object.values(all);
export const agents = (): readonly AgentDef[] => list;
export const agent = (name: string): AgentDef | undefined => list.find((a) => a.name === name);
