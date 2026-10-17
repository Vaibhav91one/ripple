// Single source of motion timing (#2). ms for CSS, `sec` for motion/react.
// Mirrored by --default-transition-duration (hover) and the keyframes in app/globals.css.
export const duration = {
  hover: 120, fast: 160, enter: 220, drawer: 240, node: 260, exit: 200, count: 300,
  medium: 320, slow: 450, long: 650, draw: 900, loop: 1200, // loop = one pulse/shimmer cycle; scale it for slower loops
} as const;
export const stagger = { hop: 140, card: 40, item: 60, tick: 20 } as const;

// cubic-bezier control points, usable by motion (arrays) and CSS (strings).
export const ease = {
  enter: [0.2, 0, 0, 1],
  exit: [0.4, 0, 1, 1],
  inOut: [0.65, 0, 0.35, 1],
  overshoot: [0.34, 1.1, 0.64, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export const cssEase = {
  enter: `cubic-bezier(${ease.enter.join(",")})`,
  exit: `cubic-bezier(${ease.exit.join(",")})`,
} as const;

// Named spring presets. Spread and add `mass` (or `type: "spring"`) where needed.
export const spring = {
  soft: { stiffness: 320, damping: 30 },
  snappy: { stiffness: 520, damping: 36 },
  stiff: { stiffness: 650, damping: 45 },
  bouncy: { stiffness: 520, damping: 18 },
  wobble: { stiffness: 220, damping: 10 },
} as const;

export const sec = (ms: number) => ms / 1000;
