// The GitHub App manifest for the one-click flow. github-app-manifest.json is the same document for the hosted instance (a test keeps them equal).
export const SLUG_DEFAULT = "ripple-company-brain";

export function buildManifest(appUrl: string) {
  const u = appUrl.replace(/\/+$/, "");
  return {
    name: "Ripple Company Brain",
    url: u,
    description: "Ripple reads repositories, CODEOWNERS and pull requests to learn which systems exist and who owns them, answers @mentions with cited impact, and posts a Ripple impact check on pull requests.",
    hook_attributes: { url: `${u}/api/connectors/github/webhook`, active: true },
    redirect_url: `${u}/setup/github/callback`,
    // request_oauth_on_install: GitHub sends the installer through user authorization and returns ?code to the first callback URL (a Setup URL is not allowed together with it)
    callback_urls: [`${u}/api/connectors/github/setup`],
    request_oauth_on_install: true,
    public: false,
    default_permissions: { contents: "read", metadata: "read", issues: "write", pull_requests: "write", checks: "write" },
    default_events: ["pull_request", "push", "issue_comment", "pull_request_review_comment"],
  };
}
