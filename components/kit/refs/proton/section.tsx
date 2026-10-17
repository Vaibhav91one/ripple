// Proton: big plain numbers and the agent-at-work card (recreated from the image). One RefRow per component.
import { RefRow } from "../RefRow";
import { AgentCard, CubeCard } from "./agent-card";
import { AgentCardDemo } from "./agent-card-demo";
import { BigStats } from "./big-stats";

const post = "https://x.com/yiliush/status/2110388214498553868";

export default function ProtonSection() {
  return (
    <>
      <RefRow n={21} name="BigStats" from="Proton" post={post} license="image recreation" img="23-proton.jpg" crop="50% 20%" skin="proton" wide
        replica={<BigStats groups={[
          { heading: "A sandbox per agent", mono: true, spread: true, stats: [{ value: "1", label: "sandbox" }, { value: "1", label: "meter" }, { value: "1", label: "clone" }] },
          { heading: "One Cube, any size", accent: true, stats: [{ value: "2", label: "CPUs" }, { value: "8", label: "GB of RAM" }, { value: "$0.028", label: "an hour" }] },
        ]} />}
        ripple={<BigStats groups={[
          { heading: "One change, every team it touches", accent: true, stats: [{ value: "5", label: "teams" }, { value: "40", label: "customers" }, { value: "$180k", label: "ARR at risk" }] },
        ]} />} />
      <RefRow n={21.5} name="AgentCard" from="Proton" post={post} license="image recreation" img="23-proton.jpg" crop="50% 85%" skin="proton" wide
        replica={
          <div className="grid grid-cols-2">
            <div className="pr-8"><AgentCardDemo title="sandbox-ccd3d0" folder="storefront" folderNote="copied" progress={1} agent="Claude Code" task="fix the flaky checkout test" status="Working" /></div>
            <div className="border-l border-hairline pl-8 pt-1"><CubeCard title="Cube" price="$0.028/hr" folder="storefront" /></div>
          </div>
        }
        ripple={
          <div className="grid grid-cols-2">
            <div className="pr-8"><AgentCard title="mcp · ripple" pill="5 teams" pillTone="gap" folder="ripple_impact" folderNote="d-1" progress={1} agent="Claude Code" task="who_wasnt_told" glyph=".:" status="3 teams untold" statusTone="gap" /></div>
            <div className="border-l border-hairline pl-8 pt-1"><CubeCard title="d-1 impact" price="$180k/yr" folder="40 customers" /></div>
          </div>
        } />
    </>
  );
}
