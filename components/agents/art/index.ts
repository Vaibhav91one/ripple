// One illustration per registered agent, keyed by agent name.
import { AccessArt } from "./access";
import { AdvisorArt } from "./advisor";
import { AskArt } from "./ask";
import { CommsArt } from "./comms";
import { ContractArt } from "./contract";
import { CourierArt } from "./courier";
import { DigestArt } from "./digest";
import { DocsArt } from "./docs";
import { ExposureArt } from "./exposure";
import { ImpactArt } from "./impact";
import { SecurityArt } from "./security";
import { SupportArt } from "./support";

export const AGENT_ART: Record<string, (p: { className?: string }) => React.JSX.Element> = {
  impact: ImpactArt, contract: ContractArt, advisor: AdvisorArt, exposure: ExposureArt, support: SupportArt,
  docs: DocsArt, security: SecurityArt, access: AccessArt, digest: DigestArt, ask: AskArt, comms: CommsArt, courier: CourierArt,
};
