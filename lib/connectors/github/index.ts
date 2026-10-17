import { defineConnector } from "../define";
import { mapGithub } from "./map";
import { syncGithub } from "./sync";
import { githubWebhook } from "./webhook";

export const GITHUB_SCOPES = ["contents:read", "metadata:read", "pull_requests:write", "checks:write", "issues:write"];

export const github = defineConnector({
  kind: "github",
  auth: "app",
  sync: syncGithub,
  map: mapGithub,
  webhook: (req, acct) => githubWebhook(req, acct),
});
