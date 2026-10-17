import { ComingSoon } from "@/components/states/ComingSoon";

export default function SettingsPage() {
  return (
    <ComingSoon title="Settings" href="/settings/members" linkLabel="Open Members">
      Members is live now. Coming next: organization profile, notification rules and API keys.
    </ComingSoon>
  );
}
