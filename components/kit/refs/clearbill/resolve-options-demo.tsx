"use client";
import { useState } from "react";
import { ResolveOptions, type ResolveOption } from "./resolve-options";

export function ResolveOptionsDemo({ heading, options }: { heading: string; options: ResolveOption[] }) {
  const [value, setValue] = useState(options[0].id);
  return <ResolveOptions heading={heading} options={options} value={value} onChange={setValue} />;
}
