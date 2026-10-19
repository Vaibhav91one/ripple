"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";
import { isGraphDown } from "@/lib/api";
import { SoundEvents } from "./SoundEvents";

// App-wide client providers: server state (TanStack Query) and URL state (nuqs).
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => !isGraphDown(e) && n < 2 } } }));
  return (
    <NuqsAdapter>
      <QueryClientProvider client={client}>{children}<SoundEvents /></QueryClientProvider>
    </NuqsAdapter>
  );
}
