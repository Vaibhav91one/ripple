import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "@/components/brand/Mark";

export const CONTACT = "vaibhavtomar3003@gmail.com";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6">
      <nav className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-medium text-strong"><Mark size={20} />Ripple</Link>
        <span className="flex gap-5 text-sm text-body">
          <Link href="/privacy" className="transition-colors hover:text-strong">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:text-strong">Terms</Link>
        </span>
      </nav>
      <article className="space-y-6 py-10 text-body [&_h2]:pt-4 [&_h2]:text-md [&_h2]:font-medium [&_h2]:text-strong [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_a]:text-ripple-ink [&_a]:hover:underline">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-strong">{title}</h1>
          <p className="font-mono text-2xs uppercase tracking-wider text-faint">Last updated {updated}</p>
        </header>
        {children}
      </article>
    </main>
  );
}
