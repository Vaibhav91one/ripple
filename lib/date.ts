/** The one date style in Ripple: "Jan 31, 2027" (UTC, so server and client agree). Epoch seconds in. */
export const fmtDate = (ts: number) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(ts * 1000);

/** An ISO "2027-01-31" as "Jan 31, 2027"; the input back when it is not a real date. */
export const isoToWords = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const t = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  return Number.isNaN(t) || new Date(t).getUTCDate() !== Number(m?.[3]) ? iso : fmtDate(t / 1000);
};
