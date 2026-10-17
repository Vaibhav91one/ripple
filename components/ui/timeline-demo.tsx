"use client";
// Client state for the Timeline: Weeks/Months toggle, search filter, Today button.
import { useState } from "react";
import { Timeline, type TimelineProps, type Zoom } from "./timeline";

type Fixed = Omit<TimelineProps, "zoom" | "onZoom" | "query" | "onQuery" | "todayTick" | "onToday">;

export function TimelineDemo({ initialZoom, ...props }: Fixed & { initialZoom: Zoom }) {
  const [zoom, setZoom] = useState<Zoom>(initialZoom);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const q = query.trim().toLowerCase();
  const groups = q ? props.groups.map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.title.toLowerCase().includes(q)) })).filter((g) => g.tasks.length) : props.groups;
  return <Timeline {...props} groups={groups} zoom={zoom} onZoom={setZoom} query={query} onQuery={setQuery} todayTick={tick} onToday={() => setTick((n) => n + 1)} />;
}
