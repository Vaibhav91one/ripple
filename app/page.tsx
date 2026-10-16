import Link from "next/link";

// Placeholder until the Landing screen (#11) lands.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-xl">Ripple</h1>
      <p className="text-faint">Change one thing. See everyone it touches, and who hasn&apos;t been told.</p>
      <Link href="/styleguide" className="text-ripple underline underline-offset-4">Styleguide</Link>
    </main>
  );
}
