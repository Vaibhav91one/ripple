// SakaniUI (sakaniui.com), MIT, see ./LICENSE. Restyled to Ripple tokens.
// No SakaniUI source for this block: recreated from the CRM dashboard screenshot (date row + refresh, one summary sentence).
import { RotateCw } from "lucide-react";

export function SummaryLine({ date, summary, onRefresh }: { date: string; summary: string; onRefresh?: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[14px] leading-5 font-medium text-strong">{date}</span>
        <button type="button" onClick={onRefresh} aria-label="Refresh summary"
          className="inline-flex size-4 items-center justify-center rounded-sm text-body hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple">
          <RotateCw size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <p className="text-[16px] leading-6 text-faint">{summary}</p>
    </div>
  );
}
