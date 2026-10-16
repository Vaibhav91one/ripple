// Pure lane layout: lanes of node ids -> centre x and top y for the Flowchart. Lanes run left to right,
// nodes in a lane stack top to bottom and each lane is centred on y = 0.
export const COL_W = 350;
export const SLOT_H = 112; // card + kind pill + breathing room

export function layoutLanes(lanes: string[][], colW = COL_W, slotH = SLOT_H): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  lanes.forEach((ids, lane) =>
    ids.forEach((id, i) => {
      out[id] = { x: lane * colW, y: (i - (ids.length - 1) / 2) * slotH };
    }),
  );
  return out;
}
