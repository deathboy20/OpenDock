import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contrastRatio } from "./contrast";
import { effectiveRefresh, formatSeconds, refreshChoices } from "./widgetOptions";

describe("widget options", () => {
  it("offers only refresh intervals a widget allows", () => {
    expect(refreshChoices("ci")[0]).toBe(60);
    expect(refreshChoices("local-ai")[0]).toBe(15);
    expect(refreshChoices("clock")).toEqual([]);
  });

  it("mirrors the Rust interval rules", () => {
    expect(effectiveRefresh("ci", null)).toBe(300);
    expect(effectiveRefresh("ci", 15)).toBe(60);
    expect(effectiveRefresh("projects", 600)).toBe(600);
    expect(effectiveRefresh("clock", 60)).toBeNull();
  });

  it("formats seconds plainly", () => {
    expect(formatSeconds(30)).toBe("30 s");
    expect(formatSeconds(300)).toBe("5 min");
    expect(formatSeconds(90)).toBe("1.5 min");
  });
});

// Vitest runs from apps/desktop.
const tokens = readFileSync(`${process.cwd()}/src/styles/tokens.css`, "utf8");

/** Reads `--name: #hex;` from one theme block of tokens.css. */
function themeTokens(theme: "dark" | "light"): Record<string, string> {
  const marker = theme === "dark" ? '[data-theme="dark"] {' : '[data-theme="light"] {';
  const start = tokens.indexOf(marker);
  const block = tokens.slice(start, tokens.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
}

describe("accent swatches", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`keep 4.5:1 ink on every ${theme} swatch and 3:1 against the panel`, () => {
      const t = themeTokens(theme);
      for (const name of ["mint", "sky", "amber", "rose", "violet"]) {
        const swatch = t[`od-swatch-${name}`];
        const ink = t[`od-swatch-${name}-ink`];
        expect(swatch, name).toBeDefined();
        expect(contrastRatio(swatch, ink), `${theme} ${name} ink`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(swatch, t["od-surface-solid"]), `${theme} ${name} on surface`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
