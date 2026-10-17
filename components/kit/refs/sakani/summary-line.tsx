// SakaniUI (sakaniui.com), MIT, see ./LICENSE. Restyled to Ripple tokens.
// No SakaniUI source for this block: recreated from the CRM dashboard screenshot (date row + refresh, one summary sentence).
import { RotateCw } from "lucide-react";

export function SummaryLine({ date, summary, onRefresh }: { date: string; summary: string; onRefresh?: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm leading-5 font-medium text-strong">{date}</span>
        <button type="button" onClick={onRefresh} aria-label="Refresh summary"
          className="transition-colors inline-flex size-4 items-center justify-center rounded-control text-body hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple">
          <RotateCw size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <p className="text-md leading-6 text-faint">{summary}</p>
    </div>
  );
}
