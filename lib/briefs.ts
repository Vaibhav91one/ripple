// Per-team briefs: claims come from the ripple rows (each with its source). A model may reword the
// claims; the citation check then drops any claim whose sources did not come from those rows.
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { graphFor, type Graph } from "./graph/client";
import { ripple } from "./graph/queries";
import { pickModel } from "./llm";
import { briefs as mockBriefs } from "./mock/ledgerly";
import { Brief, type RippleResult, type Source } from "./schemas";

type Claim = Brief["claims"][number];
export const DEMO_GRAPH = () => process.env.RIPPLE_GRAPH ?? "demo";
const key = (s: Source) => `${s.artifactId}|${s.quote}`;

/** Deterministic claims for one team from its ripple rows, worded by the mock brief when it cites the same artifact. */
export function claimsFor(r: RippleResult, teamId: string): Claim[] {
  const team = r.teams.find((t) => t.teamId === teamId);
  if (!team) return [];
  const name = r.nodes.find((n) => n.id === teamId)?.label ?? teamId;
  const mock = [...(mockBriefs.find((b) => b.teamId === teamId && b.decisionId === r.decision.id)?.claims ?? [])];
  const out = new Map<string, Claim>();
  for (const w of team.why) {
    const i = mock.findIndex((c) => c.sources.some((s) => s.artifactId === w.source.artifactId));
    const text = i >= 0 ? mock.splice(i, 1)[0].text : `${name} ${w.reason}.`;
    out.set(text, { text, sources: [w.source] });
  }
  return [...out.values()];
}

/** Keep only claims that cite at least one source, every one of them present in `allowed`. */
export function citationCheck(claims: Claim[], allowed: Source[]) {
  const ok = new Set(allowed.map(key));
  const kept = claims.filter((c) => c.sources.length > 0 && c.sources.every((s) => ok.has(key(s))));
  return { kept, dropped: claims.filter((c) => !kept.includes(c)) };
}

const Rewrite = z.object({
  claims: z.array(z.object({ text: z.string(), sources: z.array(z.object({ artifactId: z.string(), quote: z.string() })) })),
});

export async function buildBrief(
  teamId: string,
  decisionId: string,
  o: { g?: Graph; now?: number; model?: LanguageModel | null; rippleResult?: RippleResult } = {},
): Promise<Brief & { dropped: number; llm: boolean }> {
  const now = o.now ?? Math.floor(Date.now() / 1000);
  const r = o.rippleResult ?? (await ripple(o.g ?? (await graphFor(DEMO_GRAPH())), decisionId, now));
  const base = claimsFor(r, teamId);
  const model = o.model === undefined ? pickModel("agent") : o.model;
  let claims = base, dropped = 0, llm = false;
  if (model && base.length) {
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: Rewrite }),
        system:
          "Rewrite each claim as one clear sentence for the team being briefed. Change wording only: keep each claim's sources exactly as given, do not add claims or sources.",
        prompt: JSON.stringify(base),
      });
      const checked = citationCheck(output.claims, base.flatMap((c) => c.sources));
      dropped = checked.dropped.length;
      if (checked.kept.length) {
        claims = checked.kept;
        llm = true;
      }
    } catch (e) {
      console.warn(`brief rewrite failed, using deterministic claims: ${String(e)}`);
    }
  }
  return { ...Brief.parse({ teamId, decisionId, claims }), dropped, llm };
}
