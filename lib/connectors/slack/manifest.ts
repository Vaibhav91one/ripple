// slack-manifest.yaml with this deployment's URL swapped in. The file ships with https://ripple.vaibhav.quest; no secrets in it.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HOSTED = "https://ripple.vaibhav.quest";

export const slackManifest = (origin: string) =>
  readFileSync(join(/* turbopackIgnore: true */ process.cwd(), "slack-manifest.yaml"), "utf8").replaceAll(HOSTED, origin.replace(/\/+$/, ""));
