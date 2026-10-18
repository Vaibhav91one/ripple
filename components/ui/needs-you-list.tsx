import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader } from "./card";
import type { StatusTone } from "./status-pill";

const TINT: Record<StatusTone, string> = { conflict: "bg-conflict-soft text-conflict", gap: "bg-gap-soft text-gap", covered: "bg-covered-soft text-covered", ripple: "bg-ripple-soft text-ripple", neutral: "bg-raised text-body" };

export type NeedsYouRow = { id: string; icon: LucideIcon; tone: StatusTone; title: string; sub: string; href: string };

/** "Needs you": tinted icon circle, bold line, grey line, chevron. One tint per kind of item. */
export function NeedsYouList({ title = "Needs you", sub, rows, empty = "Nothing needs you right now." }: { title?: string; sub?: string; rows: NeedsYouRow[]; empty?: string }) {
  return (
    <Card id="needs-you">
      <CardHeader title={title} sub={sub ?? `${rows.length} ${rows.length === 1 ? "thing" : "things"} today`} menuLabel="More" />
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-faint">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-hairline">
          {rows.map(({ id, icon: Icon, tone, title: t, sub: s, href }) => (
            <li key={id}>
              <Link href={href} className="-mx-2 flex items-center gap-3 rounded-inset px-2 py-3 hover:bg-raised/60">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${TINT[tone]}`}><Icon size={16} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-md font-medium text-strong">{t}</span>
                  <span className="block truncate text-sm text-faint">{s}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
