import type { Skin } from "@opendock/config-schema";
import { contrastRatio } from "./contrast";

/** The base theme values a skin falls back to, from tokens.css. */
export const BASE_COLORS: Record<"dark" | "light", Record<string, string>> = {
  dark: { text: "#edf1f7", muted: "#aab4c5", surfaceSolid: "#161a24", accent: "#7cf2c8", accentInk: "#052419" },
  light: { text: "#10141c", muted: "#566174", surfaceSolid: "#ffffff", accent: "#0e9e74", accentInk: "#ffffff" },
};

const OPAQUE_HEX = /^#[0-9a-fA-F]{6}$/;

export type ContrastCheck = { theme: "dark" | "light"; pair: string; ratio: number; needed: number };

/**
 * Measures the text pairs a skin changes. Only opaque hex colours can be measured; a pair with
 * a translucent value is skipped rather than guessed.
 */
export function skinContrast(skin: Skin): ContrastCheck[] {
  const checks: ContrastCheck[] = [];
  for (const theme of ["dark", "light"] as const) {
    const values = { ...BASE_COLORS[theme], ...(skin[theme] as Record<string, string | number>) };
    const pairs: [string, string, string, number][] = [
      ["Text on panels", "text", "surfaceSolid", 4.5],
      ["Secondary text on panels", "muted", "surfaceSolid", 4.5],
      ["Text on the accent", "accentInk", "accent", 4.5],
      ["Accent on panels", "accent", "surfaceSolid", 3],
    ];
    for (const [pair, fg, bg, needed] of pairs) {
      const a = values[fg];
      const b = values[bg];
      if (typeof a === "string" && typeof b === "string" && OPAQUE_HEX.test(a) && OPAQUE_HEX.test(b)) {
        checks.push({ theme, pair, ratio: Math.round(contrastRatio(a, b) * 10) / 10, needed });
      }
    }
  }
  return checks;
}

export function contrastProblems(skin: Skin): ContrastCheck[] {
  return skinContrast(skin).filter((c) => c.ratio < c.needed);
}

/** The colours a skin card previews, falling back to the base theme. */
export function previewColors(skin: Skin | undefined, theme: "dark" | "light"): Record<string, string> {
  const values = { ...BASE_COLORS[theme], ...((skin?.[theme] ?? {}) as Record<string, string | number>) };
  const pick = (key: string) => {
    const v = values[key];
    return typeof v === "string" ? v : BASE_COLORS[theme][key];
  };
  return { surface: pick("surfaceSolid"), text: pick("text"), muted: pick("muted"), accent: pick("accent"), ink: pick("accentInk") };
}
