import Link from "next/link";
import { Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Placeholder for a route whose screen is still being built: says what's coming and links to the closest working screen. */
export function ComingSoon({ title, children, href, linkLabel }: {
  title: string; children: React.ReactNode; href: string; linkLabel: string;
}) {
  return (
    <div className="p-6">
    <div className="max-w-xl space-y-3 rounded-lg border border-hairline bg-surface p-6">
      <Hourglass className="size-5 text-faint" aria-hidden />
      <h2 className="font-medium text-strong">{title}</h2>
      <p className="text-body">{children}</p>
      <Button variant="outline" size="sm" asChild><Link href={href}>{linkLabel}</Link></Button>
    </div>
    </div>
  );
}
