"use client";
// Hover or focus a tile: it glows, the tiles joined to it glow less. Static (no glow animation) under reduced motion.
import { useState } from "react";
import { IsoTiles } from "./IsoTiles";
import { neighbours, type Scene } from "./iso";

export function IsoTilesDemo({ scene, label }: { scene: Scene; label: string }) {
  const [active, setActive] = useState<string | null>(null);
  return <IsoTiles scene={scene} label={label} active={active} related={active ? neighbours(scene.links, active) : []} onHover={setActive} />;
}
