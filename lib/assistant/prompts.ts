// Starter prompts and each agent's sample question, in one client-safe module (the chat UI imports it).
// These are served from the cache (lib/assistant/cached.ts) and never count against the demo quota.

export const STARTER_PROMPTS = [
  "Who knows the v1 auth flow?",
  "What does sunsetting API v1 touch?",
  "Which teams have not been told about the v1 sunset?",
  "Do any contracts conflict with the v1 sunset?",
  "Which customers are most at risk from the v1 sunset?",
] as const;

/** One sample question per agent, keyed by agent name (lib/agent/agents/*). */
export const AGENT_SAMPLES: Record<string, string> = {
  ask: "Who knows the v1 auth flow?",
  impact: "What does sunsetting API v1 touch?",
  contract: "Do any contracts conflict with the v1 sunset?",
  exposure: "Which customers are most at risk from the v1 sunset?",
  access: "What access changes does the v1 sunset force?",
  docs: "Which docs still point at API v1?",
  security: "What does Security need to know about the v1 sunset?",
  support: "What are customers asking Support about API v1?",
  advisor: "Should we keep the Jan 31 date for the v1 sunset?",
  digest: "What changed this week?",
  comms: "Who needs to be told about the v1 sunset, and by when?",
  courier: "How is the v1 sunset campaign going?",
};

export const normPrompt = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const exempt = new Set([...STARTER_PROMPTS, ...Object.values(AGENT_SAMPLES)].map(normPrompt));
/** True for a starter prompt or an agent's sample question: cached, free. */
export const isCachedPrompt = (text: string) => exempt.has(normPrompt(text));
