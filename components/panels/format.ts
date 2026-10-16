export const fmtDate = (ts: number) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(ts * 1000);
