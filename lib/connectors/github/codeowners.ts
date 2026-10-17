// CODEOWNERS parsing, path matching, and owner resolution. Pure: the graph directory is passed in.
export type Rule = { pattern: string; owners: string[]; section?: string };
export type Directory = {
  teams: { id: string; name: string }[];
  people: { id: string; email?: string; github?: string }[];
};
export type Ref = { label: "Team" | "Person"; id: string };

/** Lines are `pattern owner...`; `#` starts a comment; `[Section]` headers (GitLab style) label the rules below them. */
export function parseCodeowners(text: string): Rule[] {
  const rules: Rule[] = [];
  let section: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    if (!line) continue;
    const head = /^\^?\[([^\]]+)\](?:\[\d+\])?\s*(.*)$/.exec(line);
    if (head) { section = head[1]; if (!head[2]) continue; }
    const [pattern, ...owners] = (head?.[2] || line).split(/\s+/);
    if (owners.length) rules.push({ pattern, owners, ...(section ? { section } : {}) });
  }
  return rules;
}

/** gitignore-style subset: leading or inner `/` anchors, `*` stays in a segment, `**` crosses them, a directory matches everything under it. */
export function matchPath(pattern: string, path: string): boolean {
  let p = pattern;
  const anchored = p.startsWith("/") || p.replace(/\/$/, "").includes("/");
  p = p.replace(/^\//, "").replace(/\/$/, "");
  const re = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/|\*\*|\*|\?/g, (m) => ({ "**/": "(?:.*/)?", "**": ".*", "*": "[^/]*", "?": "[^/]" })[m]!);
  return new RegExp(`^${anchored ? "" : "(?:.*/)?"}${re}(?:/.*)?$`).test(path);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** `@org/team` -> Team by name or id; `@login` -> Person by github login; an email -> Person by email. null = unknown (the edge is skipped). */
export function resolveOwner(handle: string, dir: Directory): Ref | null {
  if (handle.includes("@") && !handle.startsWith("@")) {
    const p = dir.people.find((x) => x.email?.toLowerCase() === handle.toLowerCase());
    return p ? { label: "Person", id: p.id } : null;
  }
  const h = handle.replace(/^@/, "");
  if (h.includes("/")) {
    const slug = norm(h.split("/")[1]);
    const t = dir.teams.find((x) => norm(x.name) === slug || norm(x.id) === slug);
    return t ? { label: "Team", id: t.id } : null;
  }
  const p = dir.people.find((x) => x.github?.toLowerCase() === h.toLowerCase());
  return p ? { label: "Person", id: p.id } : null;
}
