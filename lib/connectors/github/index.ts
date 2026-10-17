import type { RippleEvent } from "../../events/types";
import { env } from "../../env";
import { defineConnector } from "../define";
import { verifySignature } from "./client";
import { mapGithub } from "./map";
import { syncGithub } from "./sync";

export const GITHUB_SCOPES = ["contents:read", "metadata:read", "pull_requests:write", "checks:write", "issues:write"];

type PrPayload = { action: string; number: number; pull_request: { html_url: string }; repository: { full_name: string } };

/** pull_request deliveries become pr.opened / pr.updated; everything else is acknowledged and ignored. Throws on a bad signature. */
export const github = defineConnector({
  kind: "github",
  auth: "app",
  sync: syncGithub,
  map: mapGithub,
  async webhook(req, acct) {
    const raw = await req.text();
    const secret = env().GITHUB_APP_WEBHOOK_SECRET;
    if (!secret || !(await verifySignature(secret, raw, req.headers.get("x-hub-signature-256")))) throw new Error("bad signature");
    if (req.headers.get("x-github-event") !== "pull_request") return "ignored";
    const p = JSON.parse(raw) as PrPayload;
    const type = p.action === "opened" || p.action === "reopened" ? "pr.opened" : "pr.updated";
    return [{
      type, orgId: acct.orgId, subject: { kind: "pr", id: `gh:${p.repository.full_name}#${p.number}` },
      payload: { url: p.pull_request.html_url }, dedupeKey: `github:${req.headers.get("x-github-delivery") ?? ""}`,
    } as RippleEvent];
  },
});
