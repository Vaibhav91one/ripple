import { ClerkProvider, SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { authEnabled } from "@/lib/auth";

export const metadata = { title: "Sign up · Ripple" };

function Form() {
  if (!authEnabled())
    return (
      <div className="max-w-sm space-y-3 text-center">
        <p className="text-strong">Sign-up is not configured here.</p>
        <p className="text-sm text-body">Ripple runs as a public demo with no account needed.</p>
        <Link href="/overview" className="text-sm text-ripple hover:underline">Open the live demo</Link>
      </div>
    );
  return <ClerkProvider><SignUp /></ClerkProvider>;
}

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center p-6">
      <Suspense><Form /></Suspense>
    </main>
  );
}
