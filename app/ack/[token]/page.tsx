import { Suspense } from "react";
import { connection } from "next/server";
import { AckPage } from "@/components/ack/AckPage";

const replies = { seen: "Seen", concern: "Concern", not_relevant: "Not relevant" } as const;

async function Ack({ params, searchParams }: PageProps<"/ack/[token]">) {
  const { token } = await params;
  const { r } = await searchParams;
  await connection(); // expiry depends on the clock, so render at request time
  return <AckPage token={token} reply={replies[r as keyof typeof replies]} />;
}

export default function Page(props: PageProps<"/ack/[token]">) {
  return (
    <Suspense fallback={null}>
      <Ack {...props} />
    </Suspense>
  );
}
