// Cached answers for the starter prompts and agent samples (the demo graph is fixed), plus the "budget used up" tour.
// Every quote is checked against the seed artifact at import time, like lib/mock/ledgerly.ts.
import { artifacts, askEvents } from "../mock/ledgerly";
import type { Source, StreamEvent } from "../schemas";
import { AGENT_SAMPLES, normPrompt, STARTER_PROMPTS } from "./prompts";

const byId = new Map(artifacts.map((a) => [a.id, a]));
const src = (artifactId: string, quote: string): Source => {
  if (!byId.get(artifactId)?.text.includes(quote)) throw new Error(`Quote not verbatim in ${artifactId}: ${quote}`);
  return { artifactId, quote };
};
const sunset = src("art-rfc14", "API v1 will be shut down on Jan 31, 2027");
const northwind = src("art-msa-northwind", "guarantees availability of API v1 until 2027-06-30");
const halden = src("art-msa-halden", "guarantees availability of API v1 until 2027-06-30");
const authDesign = src("art-auth-design", "auth-service verifies v1 tokens");
const sdkDocs = src("art-sdk-docs", "still point at api.ledgerly.test/v1");
const ticket = src("art-tkt-1", "429 errors from API v1");
const dealMsg = src("art-msg-deal-1", "API v1 stays available through 2027");

type Part = string | Source[];
/** Text and citations in order, closed with a `done`. */
function answer(parts: Part[], entities: string[], rowCount: number): StreamEvent[] {
  let n = 0;
  return [
    ...parts.map((p): StreamEvent => (typeof p === "string" ? { type: "text_delta", text: p } : { type: "citation", claimId: `claim-${++n}`, sources: p })),
    { type: "done", outcome: { outcome: "path", entities, paths: [], rowCount } },
  ];
}

const impact = answer(
  ["Sunsetting API v1 touches 5 teams, 40 customers, 12 open tickets, 3 open deals and 2 contracts. ", [sunset], "Eng, Support and Sales have acknowledged it; Legal, Security and DevRel have not. ", [authDesign]],
  ["API v1", "Legal", "Security", "DevRel"], 6,
);
const gap = answer(
  ["Three affected teams have not been told: Legal (2 contracts guarantee v1), Security (auth-service verifies v1 tokens) and DevRel (public docs and SDKs default to /v1). ", [northwind, authDesign, sdkDocs]],
  ["Legal", "Security", "DevRel"], 3,
);
const conflict = answer(
  ["Yes, one conflict is open. The v1 shutdown on Jan 31, 2027 contradicts two MSAs that guarantee v1 until 2027-06-30: Northwind Capital and Halden Bank. ", [sunset, northwind, halden]],
  ["Northwind Capital", "Halden Bank"], 2,
);
const exposure = answer(
  ["Northwind Capital and Halden Bank carry the most risk: their contracts guarantee v1 until 2027-06-30, about $180,000 of ARR. Three open deals also promise v1 through 2027. ", [northwind, halden, dealMsg]],
  ["Northwind Capital", "Halden Bank"], 5,
);
const access = answer(
  ["auth-service verifies v1 tokens, so every v1 credential stops working when v1 shuts down. Security has not been told, so token and key rotation is not planned yet. ", [authDesign, sunset]],
  ["auth-service", "Security"], 2,
);
const docs = answer(["The public SDK docs still point at the v1 endpoint, and DevRel has not been told about the sunset. ", [sdkDocs]], ["DevRel"], 1);
const security = answer(["auth-service verifies v1 tokens, so the sunset retires the legacy token path. Security has not acknowledged the decision yet. ", [authDesign, sunset]], ["Security", "auth-service"], 2);
const support = answer(["Support has 12 open tickets about v1, mostly 429 errors. ", [ticket], "Support has acknowledged the sunset, so replies can mention the Jan 31 date. ", [sunset]], ["Support"], 12);
const advisor = answer(
  ["Holding Jan 31 breaks two signed contracts that guarantee v1 until 2027-06-30, and three open deals promise v1 through 2027. ", [sunset, northwind, dealMsg], "The options are to move the date, amend the two contracts, or keep v1 alive for those customers only. This is a recommendation to weigh, not a decision."],
  ["d-1"], 3,
);
const digest = answer(["This week: the v1 sunset decision (d-1) is accepted, three teams still have not been told (Legal, Security, DevRel) and one conflict with two contracts is open. ", [sunset, northwind]], ["d-1"], 3);

const BY_TEXT: Record<string, StreamEvent[]> = {
  [STARTER_PROMPTS[0]]: askEvents,
  [STARTER_PROMPTS[1]]: impact,
  [STARTER_PROMPTS[2]]: gap,
  [STARTER_PROMPTS[3]]: conflict,
  [STARTER_PROMPTS[4]]: exposure,
  [AGENT_SAMPLES.access]: access,
  [AGENT_SAMPLES.docs]: docs,
  [AGENT_SAMPLES.security]: security,
  [AGENT_SAMPLES.support]: support,
  [AGENT_SAMPLES.advisor]: advisor,
  [AGENT_SAMPLES.digest]: digest,
};
const cache = new Map(Object.entries(BY_TEXT).map(([k, v]) => [normPrompt(k), v]));

/** The cached answer for a starter prompt or agent sample, else undefined. With `agent`, only that agent's own sample (no cross-agent canned answers). */
export function cachedAnswer(text: string, agent?: string): StreamEvent[] | undefined {
  if (agent && normPrompt(AGENT_SAMPLES[agent] ?? "") !== normPrompt(text)) return undefined;
  return cache.get(normPrompt(text));
}

/** Budget gone: a friendly notice, then the cached tour (the sunset impact answer). */
export function tour(): StreamEvent[] {
  return [
    { type: "text_delta", text: "The demo budget is used up for today, so live answers are paused. Here is the cached tour of what Ripple finds on the demo company. " },
    ...impact,
  ];
}
