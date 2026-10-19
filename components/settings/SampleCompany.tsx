"use client";
import { useSample, useStarters } from "@/components/assistant/Onboarding";

/** Settings card body: load or remove the Ledgerly sample company. Admins only; read-only in the shared demo. */
export function SampleCompany() {
  const { demo, sample, canManage, loaded } = useStarters();
  const { state, msg, load, remove } = useSample();
  const busy = state === "loading" || state === "removing";
  const label = sample
    ? (state === "removing" ? "Removing…" : "Remove the sample company")
    : (state === "loading" ? "Loading the sample…" : "Load the sample company");
  return (
    <div className="space-y-3">
      <p className="text-sm text-body">
        {!loaded ? "Checking…" : sample ? "Loaded: Ledgerly, a made-up fintech, is in this workspace's graph next to your own data." : "Not loaded. Adds Ledgerly, a made-up fintech, to this workspace only. Your own data is not touched."}
      </p>
      <button type="button" onClick={() => void (sample ? remove() : load())} disabled={!loaded || !canManage || busy} className="h-10 rounded-control bg-strong px-4 text-sm font-medium text-surface disabled:opacity-60">{label}</button>
      {loaded && !canManage && <p className="text-xs text-faint">{demo ? "The shared demo is read-only, so the sample cannot be changed here." : "Only org admins can load or remove the sample company."}</p>}
      {state === "error" && <p role="alert" className="text-sm text-conflict">{msg}</p>}
    </div>
  );
}
