import { Ellipsis } from "lucide-react";

/** v2 card: white, 20px radius, one hairline, no shadow. */
export function Card({ className = "", children, ...rest }: React.ComponentProps<"section">) {
  return <section className={`min-w-0 rounded-card border border-hairline bg-surface p-6 ${className}`} {...rest}>{children}</section>;
}

/** Card title (18px) + muted one-liner, with an action (link or ⋯ button) on the right. */
/** `menu` renders the round ⋯ button; it is omitted without a handler (no dead controls). */
export function CardHeader({ title, sub, action, menu }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; menu?: { label: string; onClick: () => void } }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-medium leading-6 text-strong">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-faint">{sub}</p>}
      </div>
      {action}
      {menu && (
        <button type="button" aria-label={menu.label} onClick={menu.onClick} className="grid size-9 shrink-0 place-items-center rounded-full border border-hairline text-body hover:bg-raised">
          <Ellipsis size={16} aria-hidden />
        </button>
      )}
    </header>
  );
}

/** White inset panel inside a card, for the takeaway sentence under a chart. */
export function Takeaway({ lead, sub }: { lead: string; sub?: string }) {
  return (
    <div className="rounded-inset bg-raised/60 px-4 py-3.5">
      <p className="text-md font-medium text-strong">{lead}</p>
      {sub && <p className="mt-0.5 text-sm text-faint">{sub}</p>}
    </div>
  );
}
