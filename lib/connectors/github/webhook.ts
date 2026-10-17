import type { RippleEvent } from "../../events/types";
import { env } from "../../env";
import { BadSignature, type Account } from "../define";
import { githubApp, verifySignature } from "./client";
import type { Octo } from "./sync";

type Pr = { html_url: string; title: string; body: string | null; user?: { login: string } | null };
type PrPayload = { action: string; number: number; pull_request: Pr; repository: { full_name: string } };

// GitHub caps a PR's file list at 3000 files, 100 per page.
async function changedPaths(octo: Octo, full: string, number: number): Promise<string[]> {
  const [owner, repo] = full.split("/");
  const paths: string[] = [];
  for (let page = 1; page <= 30; page++) {
    const { data } = await octo.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", { owner, repo, pull_number: number, per_page: 100, page });
    paths.push(...(data as { filename: string }[]).map((f) => f.filename));
    if (data.length < 100) break;
  }
  return paths;
}

/** pull_request opened/reopened -> pr.opened; synchronize/edited/closed -> pr.updated (changed paths fetched); other actions and events are ignored. `octo` is a test seam. */
export async function githubWebhook(req: Request, acct: Account, octo?: Octo): Promise<RippleEvent[] | "ignored"> {
  const raw = await req.text();
  const secret = env().GITHUB_APP_WEBHOOK_SECRET;
  if (!secret || !(await verifySignature(secret, raw, req.headers.get("x-hub-signature-256")))) throw new BadSignature();
  if (req.headers.get("x-github-event") !== "pull_request") return "ignored";
  const p = JSON.parse(raw) as PrPayload;
  const opened = p.action === "opened" || p.action === "reopened";
  if (!opened && !["synchronize", "edited", "closed"].includes(p.action)) return "ignored";
  const full = p.repository.full_name;
  const client = octo ?? ((await githubApp()?.getInstallationOctokit(Number(acct.token))) as Octo | undefined);
  if (!client) throw new Error("GitHub App is not configured");
  return [{
    type: opened ? "pr.opened" : "pr.updated", orgId: acct.orgId, subject: { kind: "pr", id: `gh:${full}#${p.number}` },
    payload: {
      url: p.pull_request.html_url, repo: full, number: p.number, action: p.action, title: p.pull_request.title,
      body: p.pull_request.body ?? "", author: p.pull_request.user?.login ?? "", paths: await changedPaths(client, full, p.number),
    },
    dedupeKey: `github:${req.headers.get("x-github-delivery") ?? ""}`, // ponytail: a missing header makes such deliveries collide; GitHub always sends it
  } as RippleEvent];
}
