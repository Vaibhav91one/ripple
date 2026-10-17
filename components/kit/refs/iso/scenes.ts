// Scene data for the isometric rows. Plain objects so a server section can hand them to client components.
import { at, type Item, type Scene } from "./iso";

// Simulithic: positions read off the screenshot (1200px square), top-face centres in screen px.
const slab = (id: string, sx: number, sy: number, size: number, children: Item[] = []): Item => ({
  id, ...at(sx, sy, size, 0, 0.55), tone: "base", screws: true, children,
});
const onTop = (parent: Item, id: string, size: number, h: number, extra: Partial<Item>): Item => {
  const z = (parent.z ?? 0) + parent.h;
  return { id, x: parent.x + (parent.w - size) / 2, y: parent.y + (parent.d - size) / 2, z, w: size, d: size, h, tone: "inset", ...extra };
};
const tile = (id: string, sx: number, sy: number, size: number): Item => ({ id, ...at(sx, sy, size, 0, 0.18), tone: "inset" });

const terminal = slab("terminal", 280, 372, 6.2);
terminal.children = [onTop(terminal, "terminal-tile", 3.9, 0.3, { tone: "dark", mark: "terminal" })];
const hub = slab("hub", 607, 862, 3.9);
hub.children = [onTop(hub, "hub-tile", 2.5, 0.1, { tone: "accent", mark: "logo" })];
const phoneA = slab("phone-a", 375, 748, 2.95);
phoneA.children = [onTop(phoneA, "phone-a-device", 0.1, 0, { tone: "device", mark: "phone" })];
const laptop = slab("laptop", 375, 990, 2.95);
laptop.children = [onTop(laptop, "laptop-device", 0.1, 0, { tone: "device", mark: "laptop" })];
const phoneB = slab("phone-b", 840, 990, 2.95);
phoneB.children = [onTop(phoneB, "phone-b-device", 0.1, 0, { tone: "device", mark: "phone" })];
const rail: Item = { id: "rail", ...at(803, 648, [10, 2.4], 0, 0.15), tone: "base" };
rail.children = [672, 803, 934].map((sx, k) => ({ id: `rail-${k}`, ...at(sx, sx === 803 ? 648 : sx < 803 ? 583 : 713, 1.8, 0.15, 0.1), tone: "inset" as const }));

export const simulithic: Scene = {
  items: [terminal, tile("t1", 455, 233, 1.7), tile("t2", 586, 298, 1.7), tile("t3", 519, 505, 2.2), rail, phoneA, hub, laptop, phoneB],
  links: [["terminal", "t1"], ["terminal", "t2"], ["terminal", "t3"], ["t3", "rail"], ["phone-a", "hub"], ["hub", "rail-2"], ["hub", "laptop"], ["hub", "phone-b"]],
};

// Ripple: the v1 sunset. Chain from lib/mock/ledgerly-v2.ts: reporting-export -> billing-sync -> api-gateway -> api-v1;
// Data owns reporting-export. Teams are the five affected by d-1 plus Eng/Platform. World units, x down-right, y down-left.
const sys = (id: string, label: string, x: number, y: number, tone: Item["tone"] = "inset"): Item => ({ id, label, x, y, w: 1.8, d: 1.8, h: 0.4, tone });
const apiV1: Item = { id: "api-v1", label: "api-v1", x: 6, y: 6, w: 3.2, d: 3.2, h: 0.6, tone: "accent", mark: "stone", screws: true };
const team = (id: string, label: string, x: number, tone: Item["tone"]) => sys(id, label, x, 13, tone);

export const rippleScene: Scene = {
  items: [
    apiV1,
    sys("api-gateway", "api-gateway", 12, 6.7),
    sys("billing-sync", "billing-sync", 16, 6.7),
    sys("reporting-export", "reporting-export", 20, 6.7),
    sys("data", "Data", 24, 6.7, "gap"),
    sys("auth-service", "auth-service", 1.5, 6.7, "covered"),
    team("eng", "Eng", 3, "covered"), team("support", "Support", 7, "covered"), team("sales", "Sales", 11, "covered"),
    team("security", "Security", 15, "gap"), team("legal", "Legal", 19, "gap"), team("devrel", "DevRel", 23, "gap"),
  ],
  links: [
    ["api-v1", "api-gateway", "billing-sync", "reporting-export", "data"],
    ["api-v1", "auth-service"],
    ...["eng", "support", "sales", "security", "legal", "devrel"].map((id, k) => ["api-v1", [7.6, 10.5], [3 + k * 4 + 0.9, 10.5], id] as Scene["links"][number]),
  ],
  rings: [{ x: 7.6, y: 7.6, r: 3 }, { x: 7.6, y: 7.6, r: 4.2 }, { x: 7.6, y: 7.6, r: 5.4 }],
};
