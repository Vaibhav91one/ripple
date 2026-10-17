import { ComingSoon } from "@/components/states/ComingSoon";

export default function AgentsPage() {
  return (
    <ComingSoon title="Agents" href="/overview" linkLabel="Open the overview">
      The agents Ripple runs for your org, what each one is allowed to read, and a log of everything they did. For now, the overview shows what they watch.
    </ComingSoon>
  );
}
