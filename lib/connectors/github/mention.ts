// @mention replies and the "Ripple impact" Check Run. Pure parsing + handlers that take their GitHub client and answerer as arguments (tests inject mocks).
import type { Octo } from "./sync";

export const MENTION_EVENTS = ["issue_comment", "pull_request_review_comment"];
export type MentionJob = {
  kind: "mention"; installation: number; repo: string; number: number; commentId: number; review: boolean; /** review thread to reply into: the root comment */ replyTo: number;
  text: string; author: string; title: string; context: string;
  /** public repo: answer with repo-scoped facts only */ publicRepo: boolean;
  /** over the installation's hourly reply limit: react, do not answer */ limited?: boolean;
};
export type CheckJob = { kind: "check"; installation: number; repo: string; number: number; headSha: string; url: string; /** public repo (incl. outside forks): no decision titles in the check */ publicRepo: boolean };
export type GithubJob = MentionJob | CheckJob;

type Payload = {
  action?: string; sender?: { type?: string; login?: string };
  comment?: { id: number; body?: string; user?: { login?: string }; author_association?: string; in_reply_to_id?: number };
  issue?: { number: number; title?: string; body?: string | null };
  pull_request?: { number: number; title?: string; body?: string | null };
  repository?: { full_name: string; private?: boolean };
  installation?: { id: number };
};

// Anyone can comment on a public repo; only people with a stake in it may spend our model budget.
const TRUSTED = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/** A new human comment that @mentions the app or has a line starting `/ripple`; anything else (edits, bots, our own replies) is null. */
export function parseMention(event: string, p: Payload, slug: string): Omit<MentionJob, "installation"> & { installation: number } | null {
  if (!MENTION_EVENTS.includes(event) || p.action !== "created" || !p.comment || !p.repository) return null;
  const login = p.sender?.login ?? p.comment.user?.login ?? "";
  if (p.sender?.type === "Bot" || login.toLowerCase() === `${slug}[bot]`.toLowerCase()) return null;
  if (!TRUSTED.has(p.comment.author_association ?? "")) return null;
  const body = p.comment.body ?? "";
  const at = new RegExp(`(^|[^\\w-])@${slug.replace(/[^\w-]/g, "")}(?![\\w-])`, "i");
  const cmd = /^[ \t]*\/ripple(?![\w-])/im;
  if (!at.test(body) && !cmd.test(body)) return null;
  const subject = p.issue ?? p.pull_request;
  if (!subject || !p.installation) return null;
  const text = body.replace(new RegExp(at, "gi"), "$1").replace(/^[ \t]*\/ripple(?![\w-])[ \t]*/gim, "").trim();
  return {
    kind: "mention", installation: p.installation.id, repo: p.repository.full_name, number: subject.number, commentId: p.comment.id, replyTo: p.comment.in_reply_to_id ?? p.comment.id,
    review: event === "pull_request_review_comment", text, author: login, title: subject.title ?? "", context: (subject.body ?? "").slice(0, 1500), publicRepo: p.repository.private !== true,
  };
}

/** A zero-width space after @ so a model reply can never ping people or teams. */
export const neutralize = (t: string) => t.replace(/@(?=[\w])/g, "@\u200b");

const hits = new Map<number, number[]>();
/** Sliding-window reply limiter per installation. ponytail: per process; a shared store if the web side scales out. */
export function replyAllowed(installation: number, now = Date.now(), limit = Number(process.env.GITHUB_REPLIES_PER_HOUR) || 20): boolean {
  const recent = (hits.get(installation) ?? []).filter((t) => t > now - 3_600_000);
  if (recent.length >= limit) { hits.set(installation, recent); return false; }
  hits.set(installation, [...recent, now]);
  return true;
}
export const resetLimiter = () => hits.clear();

type Failure = { status?: number; response?: { headers?: Record<string, string> } };
/** Retries 429, 5xx and 403 abuse/secondary rate limits (the ones that send retry-after), up to 3 times, waiting at most 30 s each. `sleep` is a test seam. */
export function retrying(octo: Octo, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Octo {
  return { request: async (route, params) => {
    for (let n = 0; ; n++) {
      try { return await octo.request(route, params); } catch (e) {
        const f = e as Failure;
        const wait = Number(f.response?.headers?.["retry-after"]);
        const retry = f.status === 429 || (f.status ?? 0) >= 500 || (f.status === 403 && wait > 0);
        if (!retry || n >= 3) throw e;
        await sleep(Math.min(wait > 0 ? wait : 2 ** n, 30) * 1000);
      }
    }
  } };
}

const split = (full: string) => { const [owner, repo] = full.split("/"); return { owner, repo }; };

/** The exact REST calls for a comment on an issue or PR conversation, or a reply in a review thread. */
export async function postComment(octo: Octo, repo: string, number: number, body: string, replyTo?: number) {
  const { owner, repo: name } = split(repo);
  return replyTo
    ? octo.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies", { owner, repo: name, pull_number: number, comment_id: replyTo, body })
    : octo.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", { owner, repo: name, issue_number: number, body });
}

export type Answer = { text: string; decisionId?: string };

/** Public repos get repo-scoped facts only (never the org-wide agent); private ones get the Ask agent. */
export const answerFor = (job: MentionJob, agent: (j: MentionJob) => Promise<Answer>, facts: (j: MentionJob) => Promise<Answer>) => (job.publicRepo ? facts(job) : agent(job));

/** React eyes, answer, reply as the app. The reaction is best-effort: a failed one never blocks the answer. */
export async function handleMention(job: MentionJob, octo: Octo, answer: (j: MentionJob) => Promise<Answer>, appUrl?: string) {
  const { owner, repo } = split(job.repo);
  await octo.request(job.review ? "POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions" : "POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions",
    { owner, repo, comment_id: job.commentId, content: job.limited ? "confused" : "eyes" /* confused = politely rate limited */ }).catch((e) => console.warn("[github] reaction failed:", e?.status ?? e?.message));
  if (job.limited) return;
  let a: Answer;
  try { a = await answer(job); } catch (e) { console.error("[github] answer failed:", e instanceof Error ? e.message : e); a = { text: "I could not answer that just now. Please try again in a minute." }; }
  const footer = a.decisionId && appUrl ? `\n\n[Open the case file](${appUrl.replace(/\/+$/, "")}/reports/${encodeURIComponent(a.decisionId)})` : "";
  await postComment(octo, job.repo, job.number, `@${job.author} ${neutralize(a.text)}${footer}`, job.review ? job.replyTo : undefined);
}

export type Impact = { systems: { id: string; name: string }[]; teams: string[]; decisionId?: string; decisionTitle?: string };

export function impactSummary(i: Impact): string {
  if (!i.systems.length) return "No mapped systems are touched by this PR yet.";
  const lines = [`Touches ${i.systems.length} system${i.systems.length === 1 ? "" : "s"}: ${i.systems.map((s) => `\`${s.name}\``).join(", ")}.`];
  lines.push(i.teams.length ? `Owned by: ${i.teams.join(", ")}.` : "No owning team is recorded for them.");
  if (i.decisionTitle) lines.push(`Related change in flight: ${i.decisionTitle}.`);
  return lines.join("\n");
}

/** Check Run lifecycle: in_progress, then completed (neutral: Ripple informs, it never blocks a merge). */
export async function handleCheck(job: CheckJob, octo: Octo, impact: (j: CheckJob) => Promise<Impact>) {
  const { owner, repo } = split(job.repo);
  const run = await octo.request("POST /repos/{owner}/{repo}/check-runs", { owner, repo, name: "Ripple impact", head_sha: job.headSha, status: "in_progress", details_url: job.url });
  const id = (run.data as { id: number }).id;
  let summary = "Ripple could not compute impact for this PR.";
  try { summary = impactSummary(await impact(job)); } catch (e) { console.error("[github] impact failed:", e instanceof Error ? e.message : e); } // never leave the check spinning
  finally {
    await octo.request("PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}", {
      owner, repo, check_run_id: id, status: "completed", conclusion: "neutral", output: { title: "Ripple impact", summary },
    });
  }
}
