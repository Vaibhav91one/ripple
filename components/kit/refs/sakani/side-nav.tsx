// SakaniUI (sakaniui.com), MIT, see ./LICENSE. Restyled to Ripple tokens.
// Ported from SakaniUI Sidebar / SidebarHeader / SidebarItem / SidebarGroupLabel (32px items, 14px/500 labels, badge pill,
// flat "Active - Default" tint). Pipelines/Recents group spacing and the logo mark follow the CRM dashboard screenshot.
import type { LucideIcon } from "lucide-react";

export type NavItem = { id: string; label: string; icon: LucideIcon; badge?: string };
export type NavGroupItem = { id: string; label: string; icon: LucideIcon; color: string };

const item = "transition-colors flex h-8 w-full items-center gap-2.5 rounded-control px-3 text-left text-sm leading-5 font-medium focus-visible:outline-2 focus-visible:outline-ripple";
const idle = "text-faint hover:text-strong";
const label = "mt-8 px-[22px] pb-1 text-xs leading-4 font-medium text-faint";

export function SideNav({ brand, items, active, groupTitle, group, recentsTitle, recents, onSelect }: {
  brand: string; items: NavItem[]; active: string;
  groupTitle: string; group: NavGroupItem[]; recentsTitle: string; recents: string[];
  onSelect?: (id: string) => void;
}) {
  return (
    <nav aria-label={brand} className="flex w-[270px] shrink-0 flex-col bg-page text-body">
      <div className="flex h-[60px] items-center gap-2.5 px-6">
        <span aria-hidden className="grid size-7 place-items-center rounded-control bg-strong text-md leading-none font-bold text-page">{brand[0]}</span>
        <span className="text-md leading-5 font-semibold text-strong">{brand}</span>
      </div>
      <ul className="flex flex-col gap-1 px-3">
        {items.map(({ id, label: text, icon: Icon, badge }) => {
          const on = id === active;
          return (
            <li key={id}>
              <button type="button" aria-current={on ? "page" : undefined} onClick={onSelect ? () => onSelect(id) : undefined}
                className={`${item} ${on ? "bg-raised text-strong" : idle}`}>
                <Icon size={16} strokeWidth={1.5} aria-hidden />
                <span className="flex-1 truncate">{text}</span>
                {badge && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-overlay px-1.5 text-2xs font-medium text-strong">{badge}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className={label}>{groupTitle}</p>
      <ul className="flex flex-col gap-1 px-3">
        {group.map(({ id, label: text, icon: Icon, color }) => (
          <li key={id}>
            <button type="button" onClick={onSelect ? () => onSelect(id) : undefined} className={`${item} ${idle}`}>
              <Icon size={16} strokeWidth={1.5} aria-hidden className={color} />
              <span className="flex-1 truncate">{text}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className={label}>{recentsTitle}</p>
      <ul className="flex flex-col gap-1 px-3">
        {recents.map((r) => (
          <li key={r}>
            <button type="button" className={`${item} ${idle}`}><span className="truncate">{r}</span></button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
