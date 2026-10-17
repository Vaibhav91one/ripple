// Simulithic and ISO-GLOW isometric figures. Rows for /styleguide/refs; one RefRow per component.
import { RefRow } from "../RefRow";
import { IsoTiles } from "./IsoTiles";
import { IsoTilesDemo } from "./iso-tiles-demo";
import { rippleScene, simulithic } from "./scenes";

export default function IsoSection() {
  return (
    <RefRow
      n={22} name="IsoTiles" from="Simulithic, ISO-GLOW" post="https://x.com/itsnotryan/status/2108638482054905968"
      license="image recreation" img="62-simulithic-iso.jpg" crop="50% 60%" skin="iso" wide
      replica={<div className="mx-auto max-w-2xl"><IsoTiles scene={simulithic} label="Isometric scene: a terminal slab, tiles, a rail, a hub and three devices" /></div>}
      ripple={<div className="mx-auto max-w-3xl"><IsoTilesDemo scene={rippleScene} label="The API v1 sunset as isometric tiles: systems, teams who were told and teams who were not" /></div>}
    />
  );
}
