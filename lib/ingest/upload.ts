// One uploaded file -> stored document (ingested in the worker) and, for a contract, Contract + Clause nodes. Used by /api/connectors/upload.
import { applyProposal } from "../connectors/apply";
import type { Graph } from "../graph/client";
import type { ProposeCtx } from "../actions/propose";
import { contractProposals, type ContractMeta } from "./contract";
import { parseFile } from "./parse";

export const UPLOAD_TYPES = ["document", "rfc", "contract"] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];
export type UploadResult =
  | { name: string; ok: true; chars: number; pages?: number; duplicate: boolean; clauses?: number; contractId?: string; linked?: boolean }
  | { name: string; ok: false; error: string };
type Submit = (org: ProposeCtx["org"], input: { source: "doc"; title: string; text: string; ref: string }) => Promise<{ duplicate: boolean }>;

/** `submit` is the pipeline entry (store + queue); injectable so tests need no queue. */
export async function uploadFile(
  file: { name: string; buf: Buffer },
  type: UploadType,
  meta: Omit<ContractMeta, "title">,
  env: { org: ProposeCtx["org"]; writer: () => Graph; now: number },
  submit: Submit = async (org, input) => (await import("./pipeline")).submitDocument({ org }, input),
): Promise<UploadResult> {
  try {
    const parsed = await parseFile(file.name, file.buf);
    const title = file.name.replace(/\.[^.]+$/, "") || file.name;
    const r = await submit(env.org, { source: "doc", title, text: parsed.text, ref: `upload:${type}:${file.name}` });
    const out: UploadResult = { name: file.name, ok: true, chars: parsed.text.length, pages: parsed.pages?.length, duplicate: r.duplicate };
    if (type === "contract") {
      const c = contractProposals(parsed.text, { ...meta, title });
      let linked = !meta.customerId;
      for (const p of c.proposals) {
        const a = await applyProposal(env.writer(), p, env.now);
        if (!a.applied && p.op === "merge_edge" && p.type === "PARTY_TO") linked = false;
        else if (a.applied && p.op === "merge_edge" && p.type === "PARTY_TO") linked = true;
      }
      Object.assign(out, { clauses: c.clauses.length, contractId: c.contractId, linked });
    }
    return out;
  } catch (e) {
    return { name: file.name, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
