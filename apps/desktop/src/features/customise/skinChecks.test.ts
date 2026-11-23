import { builtinSkins } from "@opendock/config-schema";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASE_COLORS, contrastProblems, previewColors, skinContrast } from "./skinChecks";

// Vitest runs from apps/desktop.
const tokens = readFileSync(`${process.cwd()}/src/styles/tokens.css`, "utf8");

function themeValue(theme: "dark" | "light", name: string): string | undefined {
  const marker = theme === "dark" ? '[data-theme="dark"] {' : '[data-theme="light"] {';
  const start = tokens.indexOf(marker);
  const block = tokens.slice(start, tokens.indexOf("}", start));
  return new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i").exec(block)?.[1];
}

describe("skin contrast", () => {
  it("uses the same base colours as tokens.css", () => {
    const names: Record<string, string> = {
      text: "od-text",
      muted: "od-muted",
      surfaceSolid: "od-surface-solid",
      accent: "od-accent",
      accentInk: "od-accent-ink",
    };
    for (const theme of ["dark", "light"] as const) {
      for (const [key, token] of Object.entries(names)) {
        expect(BASE_COLORS[theme][key], `${theme} ${key}`).toBe(themeValue(theme, token));
      }
    }
  });

  for (const skin of builtinSkins) {
    it(`${skin.name} keeps its text readable`, () => {
      expect(skinContrast(skin).length).toBeGreaterThan(0);
      expect(contrastProblems(skin)).toEqual([]);
    });
  }

  it("flags a skin with unreadable text", () => {
    const bad = { ...builtinSkins[0], dark: { text: "#333333", surfaceSolid: "#222222" }, light: {} };
    expect(contrastProblems(bad).map((p) => p.pair)).toContain("Text on panels");
  });

  it("previews a skin with base fallbacks", () => {
    expect(previewColors(undefined, "dark").accent).toBe("#7cf2c8");
    expect(previewColors(builtinSkins[4], "dark").accent).toBe("#ffd400");
  });
});
