import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { authEnabled } from "@/lib/auth";

// No auth.protect() anywhere: every route stays public. Clerk only parses the session so auth() works in handlers.
const clerk = clerkMiddleware();

export default function proxy(req: NextRequest, ev: NextFetchEvent) {
  return authEnabled() ? clerk(req, ev) : NextResponse.next();
}

export const config = { matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"] };
