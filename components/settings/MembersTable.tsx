"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["member", "lead", "change_owner", "admin"] as const;
export type MemberRow = {
  userId: string; label: string; email?: string; role: (typeof ROLES)[number]; teamIds: string[]; personId: string | null;
};
type Props = { members: MemberRow[]; teams: { id: string; name: string }[]; people: { id: string; name: string; email: string }[] };

const PAGE = 50;
const field = "rounded-md border border-hairline bg-raised px-2 py-1 text-sm text-body";

/** Admin table: role select, team checkboxes (the org graph's Team nodes), person link. Each change PATCHes and refreshes. */
export function MembersTable({ members, teams, people }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null); // only the row being changed is disabled
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const needle = q.trim().toLowerCase();
  const found = needle ? members.filter((m) => `${m.label} ${m.email ?? ""}`.toLowerCase().includes(needle)) : members;
  const pages = Math.max(1, Math.ceil(found.length / PAGE));
  const at = Math.min(page, pages);
  const shown = found.slice((at - 1) * PAGE, at * PAGE);
  const patch = (userId: string, body: object) =>
    start(async () => {
      setBusy(userId);
      const res = await fetch("/api/org/members", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, ...body }) });
      setErr(res.ok ? undefined : `Update failed (${res.status})`);
      router.refresh();
      setBusy(null);
    });

  return (
    <div className="space-y-3" aria-busy={pending}>
      {err && <p role="alert" className="text-sm text-body">{err}</p>}
      {members.length > 10 && (
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search members" aria-label="Search members" className="h-9 w-full rounded-control border border-hairline bg-surface px-3 text-sm text-strong outline-none placeholder:text-faint sm:w-64" />
      )}
      <div className="relative overflow-x-auto rounded-inset border border-hairline bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline text-faint">
            <tr><th className="sticky left-0 z-10 bg-surface p-3 font-medium">Member</th><th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Teams</th><th className="p-3 font-medium">Person</th></tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const rowBusy = pending && busy === m.userId;
              const byEmail = !m.personId && m.email ? people.find((p) => p.email.toLowerCase() === m.email!.toLowerCase()) : undefined;
              return (
                <tr key={m.userId} className="border-b border-hairline align-top last:border-0">
                  <td className="sticky left-0 z-10 min-w-40 max-w-56 bg-surface p-3 text-strong [overflow-wrap:anywhere]"><span title={m.label}>{m.label}</span>{m.email && m.email !== m.label && <div className="text-xs text-faint" title={m.email}>{m.email}</div>}</td>
                  <td className="p-3">
                    <select aria-label={`Role for ${m.label}`} className={field} value={m.role} disabled={rowBusy} onChange={(e) => patch(m.userId, { role: e.target.value })}>
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <div role="group" aria-label={`Teams for ${m.label}`} className="grid min-w-56 grid-cols-2 gap-x-3 gap-y-1">
                      {teams.map((t) => (
                        <label key={t.id} className="flex min-w-0 items-center gap-1.5 text-body" title={t.name}>
                          <input type="checkbox" checked={m.teamIds.includes(t.id)} disabled={rowBusy}
                            onChange={(e) => patch(m.userId, { teamIds: e.target.checked ? [...m.teamIds, t.id] : m.teamIds.filter((x) => x !== t.id) })} />
                          <span className="truncate">{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <select aria-label={`Person for ${m.label}`} className={field} value={m.personId ?? ""} disabled={rowBusy} onChange={(e) => patch(m.userId, { personId: e.target.value || null })}>
                      <option value="">Not linked</option>
                      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {byEmail && (
                      <button type="button" disabled={rowBusy} className="mt-1 block text-xs text-ripple-ink underline" onClick={() => patch(m.userId, { personId: byEmail.id })}>
                        Link {byEmail.name} (same email)
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length > 0 && !found.length && <tr><td colSpan={4} className="p-6 text-center text-faint">No member matches “{q}”.</td></tr>}
            {!members.length && <tr><td colSpan={4} className="p-6 text-center text-faint">No members synced yet. They appear after the Clerk webhook runs.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Member pages" className="flex items-center justify-end gap-2 text-sm text-faint">
          <button type="button" disabled={at === 1} onClick={() => setPage(at - 1)} className="h-8 rounded-control border border-hairline bg-surface px-3 text-strong disabled:opacity-50">Previous</button>
          <span className="tabular-nums">Page {at} of {pages}</span>
          <button type="button" disabled={at === pages} onClick={() => setPage(at + 1)} className="h-8 rounded-control border border-hairline bg-surface px-3 text-strong disabled:opacity-50">Next</button>
        </nav>
      )}
    </div>
  );
}
