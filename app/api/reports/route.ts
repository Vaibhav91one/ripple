import { reportList } from "@/lib/reports";
import { handle } from "@/lib/server/route";
import { ReportList } from "@/lib/schemas/reports";

/** The cases list: one row per change with state, systems, effective date, ARR at risk, coverage and the main gap. */
export const GET = () => handle(ReportList, reportList);
