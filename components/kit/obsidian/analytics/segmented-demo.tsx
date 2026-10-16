"use client";
// Styleguide demo for Segmented (controlled state lives here so /styleguide/kit can stay a server component).
import { useState } from "react";
import { Segmented } from "./segmented";

const RANGES = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
] as const;

export function SegmentedDemo() {
  const [value, setValue] = useState<(typeof RANGES)[number]["id"]>("week");
  return <Segmented label="Date range" options={RANGES} value={value} onChange={setValue} />;
}
