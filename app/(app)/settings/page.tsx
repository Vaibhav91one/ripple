import Link from "next/link";
import { Bell, KeyRound, Users } from "lucide-react";

const LINKS = [
  { href: "/settings/members", label: "Members", note: "Roles, teams and who is linked to which person.", Icon: Users },
  { href: "/settings/notifications", label: "Notifications", note: "How you hear about changes, quiet hours and the weekly digest.", Icon: Bell },
  { href: "/settings/api-keys", label: "API keys", note: "Let Claude Code or Cursor read the graph over MCP as you.", Icon: KeyRound },
];

export default function SettingsPage() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-lg font-medium text-strong">Settings</h1>
      <ul className="grid max-w-3xl gap-3 sm:grid-cols-2">
        {LINKS.map(({ href, label, note, Icon }) => (
          <li key={href}>
            <Link href={href} className="block h-full space-y-2 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:bg-raised">
              <Icon className="size-4 text-faint" aria-hidden />
              <div className="font-medium text-strong">{label}</div>
              <p className="text-sm text-body">{note}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
