import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandIcon, type BrandName } from "./BrandIcon";
import { LOGOS } from "./logos";

const NAMES = Object.keys(LOGOS) as BrandName[];

describe("BrandIcon", () => {
  it("has the 16 integration logos", () => {
    expect(NAMES.sort()).toEqual(
      ["github", "slack", "jira", "notion", "vscode", "postgres", "google", "linear", "hubspot", "zendesk", "googledrive", "claude", "claudecode", "codex", "cursor", "mcp"].sort(),
    );
  });

  it.each(NAMES)("%s renders an svg with a path", (name) => {
    const html = renderToStaticMarkup(<BrandIcon name={name} />);
    expect(html).toContain("<svg");
    expect(html).toMatch(/<path|<circle|<rect|<polygon|<g/);
  });

  it.each(NAMES)("%s has a source svg file in logos/", (name) => {
    expect(existsSync(join(__dirname, "logos", `${name}.svg`))).toBe(true);
  });

  it("sets size, viewBox and an accessible label when titled", () => {
    const html = renderToStaticMarkup(<BrandIcon name="github" size={32} title="GitHub" />);
    expect(html).toContain('width="32"');
    expect(html).toContain('height="32"');
    expect(html).toContain('viewBox="0 0 128 128"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="GitHub"');
  });

  it("hides decorative icons from assistive tech", () => {
    expect(renderToStaticMarkup(<BrandIcon name="slack" />)).toContain('aria-hidden="true"');
  });
});
