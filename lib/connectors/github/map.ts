// GitHub records -> structured graph proposals. Pure. Everything here is stated outright by GitHub (CODEOWNERS, PR author, review), so structured = true.
import type { GraphProposal } from "../define";
import { matchPath, parseCodeowners, resolveOwner, type Directory, type Ref } from "./codeowners";

export type RepoRecord = { t: "repo"; full: string; url: string; codeowners: string | null; dir: Directory; /** current OWNED_BY edges of this repo's systems, so owners dropped from CODEOWNERS get ended */ existing?: ExistingOwner[] };
export type ExistingOwner = { sys: string; owner: Ref };
export type PrRecord = {
  t: "pr"; full: string; number: number; title: string; body: string | null; url: string; state: "open" | "closed";
  createdAt: string; author: string | null; reviewers: string[]; files: string[]; patterns: string[]; dir: Directory;
};
export type GithubRecord = RepoRecord | PrRecord;

export const repoId = (full: string) => `gh:${full}`;
export const pathId = (full: string, pattern: string) => `gh:${full}:${pattern}`;
export const prId = (full: string, n: number) => `gh:${full}#${n}`;
const ownable = (pattern: string) => pattern !== "*" && pattern !== "/*";

type Node = { label: "System" | "PR"; id: string };
const base = { confidence: 1, structured: true } as const;
const node = (label: Node["label"], id: string, props: Record<string, string | number | boolean>, src: string, labels?: ["Artifact"]): GraphProposal => ({ op: "merge_node", label, ...(labels ? { labels } : {}), id, props, src, ...base });
const edge = (type: string, from: Ref | Node, to: Ref | Node, src: string): GraphProposal => ({ op: "merge_edge", type, from, to, props: {}, src, ...base });

export function mapRepo(r: RepoRecord): GraphProposal[] {
  const src = `github:repo/${r.full}`;
  const repo: Node = { label: "System", id: repoId(r.full) };
  const out = [node("System", repo.id, { name: r.full, kind: "repo", status: "current", uri: r.url }, src)];
  const wanted = new Set<string>();
  for (const rule of r.codeowners ? parseCodeowners(r.codeowners) : []) {
    let sys = repo;
    if (ownable(rule.pattern)) { // a CODEOWNERS path becomes its own system so PRs can be ABOUT it
      sys = { label: "System", id: pathId(r.full, rule.pattern) };
      out.push(node("System", sys.id, { name: `${r.full} ${rule.pattern}`, kind: "repo", status: "current", path: rule.pattern, ...(rule.section ? { section: rule.section } : {}) }, src));
    }
    for (const o of rule.owners) {
      const ref = resolveOwner(o, r.dir);
      if (ref) { wanted.add(`${sys.id}|${ref.id}`); out.push(edge("OWNED_BY", sys, ref, `${src}#CODEOWNERS ${rule.pattern}`)); }
    }
  }
  // an owner (or a whole path section) that CODEOWNERS no longer lists: end the edge, keep the history
  for (const x of r.existing ?? []) if (!wanted.has(`${x.sys}|${x.owner.id}`)) out.push({ op: "end_edge", type: "OWNED_BY", from: { label: "System", id: x.sys }, to: x.owner, props: {}, src: `${src}#CODEOWNERS`, ...base });
  return out;
}

export function mapPr(r: PrRecord): GraphProposal[] {
  const src = `github:pr/${r.full}#${r.number}`;
  const pr: Node = { label: "PR", id: prId(r.full, r.number) };
  const text = `${r.title}\n\n${r.body ?? ""}`.trim().slice(0, 2000);
  const person = (login: string) => resolveOwner(`@${login}`, r.dir);
  const author = r.author ? person(r.author) : null;
  // same shape as a seeded PR (:PR:Artifact with kind, title, text, ts, uri, author) so search, permissions, item pages and who_knows treat it alike
  const out = [node("PR", pr.id, { kind: "pr", title: r.title, text, status: r.state, ts: Math.floor(Date.parse(r.createdAt) / 1000), uri: r.url, author: author?.id ?? r.author ?? "unknown" }, src, ["Artifact"])];
  if (author) out.push(edge("AUTHORED", author, pr, src));
  for (const login of new Set(r.reviewers)) {
    const p = login === r.author ? null : person(login);
    if (p) out.push(edge("REVIEWED", p, pr, src));
  }
  out.push(edge("ABOUT", pr, { label: "System", id: repoId(r.full) }, src));
  for (const pattern of r.patterns) if (ownable(pattern) && r.files.some((f) => matchPath(pattern, f))) out.push(edge("ABOUT", pr, { label: "System", id: pathId(r.full, pattern) }, src));
  return out;
}

export const mapGithub = (rec: unknown): GraphProposal[] => ((rec as GithubRecord).t === "repo" ? mapRepo(rec as RepoRecord) : mapPr(rec as PrRecord));
