import { ClerkProvider, SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { authEnabled } from "@/lib/auth";

export const metadata = { title: "Sign in · Ripple" };

function Form() {
  if (!authEnabled())
    return (
      <div className="max-w-sm space-y-3 text-center">
        <p className="text-strong">Sign-in is not configured here.</p>
        <p className="text-sm text-body">Ripple runs as a public demo with no account needed.</p>
        <Link href="/home" className="text-sm text-ripple hover:underline">Open the live demo</Link>
      </div>
    );
  return <ClerkProvider><SignIn fallbackRedirectUrl="/home" /></ClerkProvider>;
}

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 p-6">
      <Suspense><Form /></Suspense>
      <p className="flex gap-4 text-xs text-faint">
        <Link href="/privacy" className="transition-colors hover:text-body">Privacy</Link>
        <Link href="/terms" className="transition-colors hover:text-body">Terms</Link>
      </p>
    </main>
  );
}
