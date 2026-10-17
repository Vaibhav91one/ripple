import { ClerkProvider } from "@clerk/nextjs";
import { authEnabled } from "@/lib/auth";
import { AuthControls } from "./AuthControls";

/** Header slot. Render inside <Suspense>: ClerkProvider reads request data, so it stays out of the static shell. Empty when auth is off. */
export function AuthArea() {
  if (!authEnabled()) return null;
  return <ClerkProvider><AuthControls /></ClerkProvider>;
}
