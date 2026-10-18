import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Calm empty state: icon in a soft circle, one line of what, one of why, one way forward. */
export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: React.ReactNode; action?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-raised text-body"><Icon size={20} aria-hidden /></span>
      <h2 className="mt-4 text-lg font-medium text-strong">{title}</h2>
      {children && <p className="mt-1.5 max-w-md text-md leading-relaxed text-faint">{children}</p>}
      {action && (
        <Link href={action.href} className="mt-5 inline-flex h-10 items-center rounded-control border border-hairline bg-surface px-4 text-sm font-medium text-strong hover:bg-raised">{action.label}</Link>
      )}
    </div>
  );
}
