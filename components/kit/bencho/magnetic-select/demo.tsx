"use client";
// Styleguide demo (controlled state lives here so /styleguide/kit can stay a server component).
import { useState } from "react";
import { BookOpen, Code2, Handshake, Headset, Scale, ShieldCheck, Target } from "lucide-react";
import { MagneticSelect } from "./MagneticSelect";

const ICON = { strokeWidth: 1.8 } as const;
export const TEAMS = [
  { id: "eng", label: "Eng", icon: <Code2 {...ICON} /> },
  { id: "support", label: "Support", icon: <Headset {...ICON} /> },
  { id: "sales", label: "Sales", icon: <Handshake {...ICON} /> },
  { id: "legal", label: "Legal", icon: <Scale {...ICON} /> },
  { id: "security", label: "Security", icon: <ShieldCheck {...ICON} /> },
  { id: "devrel", label: "DevRel", icon: <BookOpen {...ICON} /> },
  { id: "leadership", label: "Leadership", icon: <Target {...ICON} /> },
];

export function MagneticSelectDemo({ count = 7 }: { count?: 3 | 7 }) {
  const options = TEAMS.slice(0, count);
  const [value, setValue] = useState<string | null>(options[0].id);
  return (
    <div className="space-y-2">
      <MagneticSelect options={options} value={value} onChange={setValue} label="Team" />
      <p className="text-center text-faint">{options.find((o) => o.id === value)?.label ?? "Nothing selected"}</p>
    </div>
  );
}
