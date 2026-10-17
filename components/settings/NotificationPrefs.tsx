"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const URGENCIES = [["high", "Urgent"], ["normal", "Normal"], ["low", "Low"]] as const;
const CHANNELS = [["slack_dm", "Slack DM"], ["email", "Email"], ["inbox", "In-app"]] as const;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
type Urgency = (typeof URGENCIES)[number][0];
type Channel = (typeof CHANNELS)[number][0];

export type FormValues = {
  channels: Record<Urgency, Channel[]>;
  tz: string; quiet: boolean; quietStart: string; quietEnd: string;
  digest: boolean; digestDay: string;
};
type Props = { title: string; note?: string; initial: FormValues; zones: string[]; scope: "me" | "org"; readOnly?: boolean };

const field = "rounded-md border border-hairline bg-raised px-2 py-1 text-sm text-body disabled:opacity-60";

/** One settings card: channel toggles per urgency, quiet hours with a time zone, and the weekly digest. PUTs to /api/settings/notifications. */
export function NotificationPrefs({ title, note, initial, zones, scope, readOnly }: Props) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const set = (p: Partial<FormValues>) => { setV({ ...v, ...p }); setMsg(undefined); };
  const toggle = (u: Urgency, c: Channel, on: boolean) =>
    set({ channels: { ...v.channels, [u]: on ? [...v.channels[u], c] : v.channels[u].filter((x) => x !== c) } });
  const off = readOnly || pending;

  const save = () =>
    start(async () => {
      // A person who turns quiet hours off saves start == end, which beats the org default; the org just clears them.
      const quiet = v.quiet ? { quietStart: v.quietStart, quietEnd: v.quietEnd } : scope === "me" ? { quietStart: "00:00", quietEnd: "00:00" } : { quietStart: null, quietEnd: null };
      const body = { scope, channels: v.channels, tz: v.tz, ...quiet, ...(scope === "me" ? { digest: v.digest } : { digestDay: v.digest ? v.digestDay : "off" }) };
      const res = await fetch("/api/settings/notifications", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setMsg(res.ok ? { ok: true, text: "Saved" } : { ok: false, text: `Save failed (${res.status})` });
      router.refresh();
    });

  return (
    <section className="space-y-5 rounded-lg border border-hairline bg-surface p-4 sm:p-5" aria-busy={pending}>
      <header>
        <h2 className="font-medium text-strong">{title}</h2>
        {note && <p className="text-sm text-faint">{note}</p>}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-faint">
            <tr><th className="py-2 pr-3 font-medium">How urgent</th>{CHANNELS.map(([, l]) => <th key={l} className="px-3 py-2 font-medium">{l}</th>)}</tr>
          </thead>
          <tbody>
            {URGENCIES.map(([u, label]) => (
              <tr key={u} className="border-t border-hairline">
                <th scope="row" className="py-2 pr-3 font-normal text-strong">{label}</th>
                {CHANNELS.map(([c, cl]) => (
                  <td key={c} className="px-3 py-2">
                    <input type="checkbox" aria-label={`${label} via ${cl}`} checked={v.channels[u].includes(c)} disabled={off} onChange={(e) => toggle(u, c, e.target.checked)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-strong">Quiet hours</legend>
        <label className="flex items-start gap-2 text-sm text-body">
          <input type="checkbox" className="mt-1" checked={v.quiet} disabled={off} onChange={(e) => set({ quiet: e.target.checked })} />
          Hold normal and low messages until quiet hours end (urgent ones always come through)
        </label>
        <div className="flex flex-wrap items-center gap-2 text-sm text-body">
          <input type="time" aria-label="Quiet hours start" className={field} value={v.quietStart} disabled={off || !v.quiet} onChange={(e) => set({ quietStart: e.target.value })} />
          to
          <input type="time" aria-label="Quiet hours end" className={field} value={v.quietEnd} disabled={off || !v.quiet} onChange={(e) => set({ quietEnd: e.target.value })} />
          <select aria-label="Time zone" className={`${field} max-w-full`} value={v.tz} disabled={off} onChange={(e) => set({ tz: e.target.value })}>
            {(zones.includes(v.tz) ? zones : [v.tz, ...zones]).map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 text-sm text-body">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.digest} disabled={off} onChange={(e) => set({ digest: e.target.checked })} />
          Weekly digest
        </label>
        {scope === "org" && v.digest && (
          <select aria-label="Digest day" className={field} value={v.digestDay} disabled={off} onChange={(e) => set({ digestDay: e.target.value })}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={pending}>Save</Button>
          {msg && <p role={msg.ok ? "status" : "alert"} className="text-sm text-body">{msg.text}</p>}
        </div>
      )}
    </section>
  );
}
