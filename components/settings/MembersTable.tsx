"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["member", "lead", "change_owner", "admin"] as const;
export type MemberRow = {
  userId: string; label: string; email?: string; role: (typeof ROLES)[number]; teamIds: string[]; personId: string | null;
};
type Props = { members: MemberRow[]; teams: { id: string; name: string }[]; people: { id: string; name: string; email: string }[] };

const field = "rounded-md border border-hairline bg-raised px-2 py-1 text-sm text-body";

/** Admin table: role select, team checkboxes (the org graph's Team nodes), person link. Each change PATCHes and refreshes. */
export function MembersTable({ members, teams, people }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const patch = (userId: string, body: object) =>
    start(async () => {
      const res = await fetch("/api/org/members", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, ...body }) });
      setErr(res.ok ? undefined : `Update failed (${res.status})`);
      router.refresh();
    });

  return (
    <div className="space-y-3" aria-busy={pending}>
      {err && <p role="alert" className="text-sm text-body">{err}</p>}
      <div className="overflow-x-auto rounded-inset border border-hairline bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline text-faint">
            <tr><th className="p-3 font-medium">Member</th><th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Teams</th><th className="p-3 font-medium">Person</th></tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const byEmail = !m.personId && m.email ? people.find((p) => p.email.toLowerCase() === m.email!.toLowerCase()) : undefined;
              return (
                <tr key={m.userId} className="border-b border-hairline align-top last:border-0">
                  <td className="p-3 text-strong">{m.label}{m.email && m.email !== m.label && <div className="text-xs text-faint">{m.email}</div>}</td>
                  <td className="p-3">
                    <select aria-label={`Role for ${m.label}`} className={field} value={m.role} disabled={pending} onChange={(e) => patch(m.userId, { role: e.target.value })}>
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <div role="group" aria-label={`Teams for ${m.label}`} className="flex flex-wrap gap-x-3 gap-y-1">
                      {teams.map((t) => (
                        <label key={t.id} className="flex items-center gap-1.5 text-body">
                          <input type="checkbox" checked={m.teamIds.includes(t.id)} disabled={pending}
                            onChange={(e) => patch(m.userId, { teamIds: e.target.checked ? [...m.teamIds, t.id] : m.teamIds.filter((x) => x !== t.id) })} />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <select aria-label={`Person for ${m.label}`} className={field} value={m.personId ?? ""} disabled={pending} onChange={(e) => patch(m.userId, { personId: e.target.value || null })}>
                      <option value="">Not linked</option>
                      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {byEmail && (
                      <button type="button" disabled={pending} className="mt-1 block text-xs text-ripple underline" onClick={() => patch(m.userId, { personId: byEmail.id })}>
                        Link {byEmail.name} (same email)
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!members.length && <tr><td colSpan={4} className="p-6 text-center text-faint">No members synced yet. They appear after the Clerk webhook runs.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
