"use client";
// Chips pick a team: its region stays lit, the others fade, and the card shows that team.
import { useState, type ComponentProps } from "react";
import { TeamHeatMap, type HeatCard } from "./TeamHeatMap";

export function TeamHeatMapDemo({ cards, ...rest }: Omit<ComponentProps<typeof TeamHeatMap>, "activeChip" | "onChip" | "card" | "focus"> & { cards: Record<string, HeatCard> }) {
  const [chip, setChip] = useState(rest.chips[0].id);
  const first = rest.chips[0].id;
  return <TeamHeatMap {...rest} activeChip={chip} onChip={setChip} card={cards[chip]} focus={chip === first ? null : chip} />;
}
