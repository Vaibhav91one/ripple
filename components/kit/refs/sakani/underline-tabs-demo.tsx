// Interactive wrapper for UnderlineTabs: owns the selected tab (client state lives here, not in the component).
"use client";
import { useState } from "react";
import { UnderlineTabs, type TabItem } from "./underline-tabs";

export function UnderlineTabsDemo({ items, searchPlaceholder }: { items: TabItem[]; searchPlaceholder: string }) {
  const [value, setValue] = useState(items[0].value);
  return <div className="max-w-[780px]"><UnderlineTabs items={items} value={value} onChange={setValue} searchPlaceholder={searchPlaceholder} /></div>;
}
