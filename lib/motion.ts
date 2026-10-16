// Single source of motion timing (#2). ms for CSS, `sec` for motion/react.
export const duration = { hover: 120, enter: 220, drawer: 240, count: 300, node: 260, exit: 200 } as const;
export const stagger = { hop: 140, card: 40 } as const;

// cubic-bezier control points, usable by motion (arrays) and CSS (strings).
export const ease = { enter: [0.2, 0, 0, 1], exit: [0.4, 0, 1, 1] } as const satisfies Record<string, readonly [number, number, number, number]>;
export const cssEase = {
  enter: `cubic-bezier(${ease.enter.join(",")})`,
  exit: `cubic-bezier(${ease.exit.join(",")})`,
} as const;

export const sec = (ms: number) => ms / 1000;
