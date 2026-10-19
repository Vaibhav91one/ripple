import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// WCAG contrast of the colour pairs the pills, badges and buttons use, computed from the oklch tokens in app/globals.css.
const css = readFileSync("app/globals.css", "utf8");
type RGBA = [number, number, number, number];

function token(name: string): RGBA {
  const m = css.match(new RegExp(`--${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)(?: / ([\\d.]+)%)?\\)`));
  if (!m) throw new Error(`no oklch token --${name}`);
  const [L, C, h] = [+m[1], +m[2], (+m[3] * Math.PI) / 180];
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s];
  const enc = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
  return [enc(rgb[0]), enc(rgb[1]), enc(rgb[2]), m[4] ? +m[4] / 100 : 1];
}
const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
const lum = (c: RGBA) => { const f = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
export const ratio = (fg: RGBA, bg: RGBA) => { const [x, y] = [lum(fg), lum(bg)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const white = token("surface"), page = token("page");
const pairs: [string, RGBA, RGBA][] = [];
for (const t of ["gap", "conflict", "covered", "ripple"]) {
  const ink = token(`${t}-ink`), soft = token(`${t}-soft`);
  pairs.push([`${t}-ink on surface`, ink, white], [`${t}-ink on page`, ink, page], [`${t}-ink on ${t}-soft`, ink, over(soft, white)], [`${t}-ink on ${t}-soft over page`, ink, over(soft, page)]);
}
pairs.push(
  ["strong on solid gap (amber badge)", token("strong"), token("gap")],
  ["ink-on-strong on solid conflict-ink (danger button)", token("ink-on-strong"), token("conflict-ink")],
  ["ink-on-strong on solid ripple-ink", token("ink-on-strong"), token("ripple-ink")],
  ["faint on page", token("faint"), page],
  ["faint on raised", token("faint"), token("raised")],
);

test.each(pairs)("%s is at least 4.5:1", (_, fg, bg) => {
  expect(Math.round(ratio(fg, bg) * 100) / 100).toBeGreaterThanOrEqual(4.5);
});

test("print the table", () => {
  console.log(pairs.map(([n, f, b]) => `${ratio(f, b).toFixed(2)}:1  ${n}`).join("\n"));
});
