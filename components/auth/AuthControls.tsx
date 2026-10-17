"use client";

import { OrganizationSwitcher, Show, SignInButton, UserButton } from "@clerk/nextjs";

/** Org switcher + user menu; signed out shows a Sign in button. The demo stays open either way. */
export function AuthControls() {
  return (
    <>
      <Show when="signed-in">
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/overview" afterCreateOrganizationUrl="/overview" />
        <UserButton />
      </Show>
      <Show when="signed-out">
        <SignInButton>
          <button type="button" className="rounded-md border border-hairline px-3 py-1.5 text-sm text-body transition-colors hover:text-strong">Sign in</button>
        </SignInButton>
      </Show>
    </>
  );
}
