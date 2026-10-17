// Registry. A connector issue adds its file here; the catalog is what /connectors offers.
import { csv } from "./csv";
import type { Connector } from "./define";
import { github } from "./github";

export const CONNECTORS: Record<string, Connector> = { csv };
export const register = (c: Connector) => (CONNECTORS[c.kind] = c);
register(github);

export type CatalogEntry = { kind: string; name: string; blurb: string; auth: Connector["auth"] };
export const CATALOG: CatalogEntry[] = [
  { kind: "github", name: "GitHub", blurb: "Pull requests, issues and who owns which repo.", auth: "app" },
  { kind: "slack", name: "Slack", blurb: "Decisions and questions raised in channels.", auth: "oauth" },
  { kind: "linear", name: "Linear", blurb: "Issues, projects and their owners.", auth: "oauth" },
  { kind: "hubspot", name: "HubSpot", blurb: "Deals and customer accounts.", auth: "oauth" },
  { kind: "zendesk", name: "Zendesk", blurb: "Support tickets and escalations.", auth: "apikey" },
  { kind: "csv", name: "CSV and file upload", blurb: "Customers, deals, usage and access from a spreadsheet.", auth: "upload" },
];
