// Installation sync: repos -> CODEOWNERS, then PRs updated in the last 90 days (files + reviews). One page per repo.
import { query, type Graph } from "../../graph/client";
import type { Account, SyncPage } from "../define";
import { githubApp } from "./client";
import { parseCodeowners, type Directory } from "./codeowners";
import type { ExistingOwner, PrRecord, RepoRecord } from "./map";

const DAY = 86_400_000;
const CODEOWNERS_PATHS = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];

async function orgGraph(orgId: string) {
  const [{ db }, { orgs }, { graphFor }, { eq }] = await Promise.all([import("../../db"), import("../../db/schema"), import("../../graph/client"), import("drizzle-orm")]);
  const [org] = await db().select().from(orgs).where(eq(orgs.id, orgId));
  return graphFor(org.graphName);
}

/** The org's Teams and Persons, for resolving CODEOWNERS handles and PR logins. Person.github is optional. */
export async function loadDirectory(orgId: string): Promise<Directory> {
  const g = await orgGraph(orgId);
  const [teams, people] = await Promise.all([
    query<{ id: string; name: string }>(g, "MATCH (t:Team) RETURN t.id AS id, t.name AS name"),
    query<{ id: string; email: string | null; github: string | null }>(g, "MATCH (p:Person) RETURN p.id AS id, p.email AS email, p.github AS github"),
  ]);
  return { teams, people: people.map((p) => ({ id: p.id, email: p.email ?? undefined, github: p.github ?? undefined })) };
}

/** Current OWNED_BY edges of a repo's systems (the repo itself and its `gh:<repo>:<path>` systems). */
export const loadOwned = async (orgId: string, full: string) => ownedIn(await orgGraph(orgId), full);
export async function ownedIn(g: Graph, full: string): Promise<ExistingOwner[]> {
  const rows = await query<{ sys: string; label: string; id: string }>(g,
    "MATCH (s:System)-[r:OWNED_BY]->(o) WHERE (s.id = $repo OR s.id STARTS WITH $paths) AND r.valid_to IS NULL RETURN s.id AS sys, labels(o)[0] AS label, o.id AS id", { repo: `gh:${full}`, paths: `gh:${full}:` });
  return rows.map((x) => ({ sys: x.sys, owner: { label: x.label as "Team" | "Person", id: x.id } }));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Octo = { request: (route: string, params?: Record<string, unknown>) => Promise<{ data: any }> };

/** `seam` is for tests. token = the installation id (connector_account.token_enc). nextCursor = last finished repo; the final page clears it so the next run starts over. */
export async function* syncGithub(acct: Account, cursor: unknown, seam: { octo?: Octo; dir?: Directory; owned?: (full: string) => Promise<ExistingOwner[]>; now?: number } = {}): AsyncGenerator<SyncPage> {
  const octo = seam.octo ?? ((await (await githubApp(await (await import("./app-creds")).githubEnv()))?.getInstallationOctokit(Number(acct.token))) as Octo | undefined);
  if (!octo) throw new Error("GitHub App is not configured");
  const dir = seam.dir ?? (await loadDirectory(acct.orgId));
  const since = (seam.now ?? Date.now()) - 90 * DAY;
  const { data } = await octo.request("GET /installation/repositories", { per_page: 100 }); // ponytail: first 100 repos; paginate when an install has more
  const repos = (data.repositories as { full_name: string; html_url: string }[]).map((r) => ({ full: r.full_name, url: r.html_url })).sort((a, b) => a.full.localeCompare(b.full));
  const todo = typeof cursor === "string" ? repos.filter((r) => r.full > cursor) : repos;
  for (const [i, r] of todo.entries()) {
    const [owner, repo] = r.full.split("/");
    let codeowners: string | null = null;
    for (const path of CODEOWNERS_PATHS) {
      const res = await octo.request("GET /repos/{owner}/{repo}/contents/{path}", { owner, repo, path }).catch((e) => { if (e?.status === 404) return null; throw e; });
      if (res && !Array.isArray(res.data) && res.data.content) { codeowners = Buffer.from(res.data.content, "base64").toString("utf8"); break; }
    }
    const patterns = codeowners ? parseCodeowners(codeowners).map((x) => x.pattern) : [];
    const records: (RepoRecord | PrRecord)[] = [{ t: "repo", full: r.full, url: r.url, codeowners, dir, existing: await (seam.owned ?? ((f) => loadOwned(acct.orgId, f)))(r.full) }];
    const prs = await octo.request("GET /repos/{owner}/{repo}/pulls", { owner, repo, state: "all", sort: "updated", direction: "desc", per_page: 50 }); // ponytail: newest 50 PRs
    for (const p of prs.data as any[]) {
      if (Date.parse(p.updated_at) < since) break;
      const [files, reviews] = await Promise.all([
        octo.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", { owner, repo, pull_number: p.number, per_page: 100 }),
        octo.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", { owner, repo, pull_number: p.number, per_page: 100 }),
      ]);
      records.push({
        t: "pr", full: r.full, number: p.number, title: p.title, body: p.body, url: p.html_url, state: p.state, createdAt: p.created_at,
        author: p.user?.login ?? null, reviewers: (reviews.data as any[]).map((x) => x.user?.login).filter(Boolean),
        files: (files.data as { filename: string }[]).map((f) => f.filename), patterns, dir,
      });
    }
    yield { records, nextCursor: i === todo.length - 1 ? null : r.full };
  }
}
