import { z } from "zod";
import builtinSkinData from "./builtin-skins.json";
import skinTokenData from "./skin-tokens.json";

/**
 * Skins are packs of design-token overrides. Only the tokens in skin-tokens.json can be set,
 * and every value is checked by kind, so a skin can't carry CSS, URLs or scripts. The Rust
 * validator in `settings/skins.rs` reads the same file.
 */
export type SkinTokenKind = "color" | "length" | "duration" | "font" | "shadow";
type TokenSpec = { var: string; kind: SkinTokenKind; max?: number };

export const skinTokens = skinTokenData.tokens as Record<string, TokenSpec>;
export const skinFonts = skinTokenData.fonts as Record<string, string>;
export const skinShadows = skinTokenData.shadows as Record<string, string>;
export const MAX_CUSTOM_SKINS = 20;

const HEX = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const RGBA = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d{1,3}|1\.0{1,3})\s*\)$/;

export function isSkinColor(value: string): boolean {
  if (HEX.test(value)) return true;
  const m = RGBA.exec(value);
  return m !== null && [m[1], m[2], m[3]].every((c) => Number(c) <= 255);
}

export function isValidSkinValue(token: string, value: unknown): boolean {
  const spec = skinTokens[token];
  if (!spec) return false;
  switch (spec.kind) {
    case "color":
      return typeof value === "string" && value.length <= 40 && isSkinColor(value);
    case "length":
    case "duration":
      return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= (spec.max ?? 0);
    case "font":
      return typeof value === "string" && Object.prototype.hasOwnProperty.call(skinFonts, value);
    case "shadow":
      return typeof value === "string" && Object.prototype.hasOwnProperty.call(skinShadows, value);
  }
}

const tokenMapSchema = z
  .record(z.string(), z.union([z.string(), z.number()]))
  .superRefine((map, ctx) => {
    for (const [token, value] of Object.entries(map)) {
      if (!isValidSkinValue(token, value)) {
        ctx.addIssue({ code: "custom", message: `${token} has a value a skin can't use`, path: [token] });
      }
    }
  });

export const skinIdSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "use lowercase letters, digits and dashes");

export const skinSchema = z.object({
  format: z.literal("opendock-skin"),
  version: z.literal(1),
  id: skinIdSchema,
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(160).default(""),
  dark: tokenMapSchema.default({}),
  light: tokenMapSchema.default({}),
});

export type Skin = z.infer<typeof skinSchema>;

export const builtinSkins: Skin[] = (builtinSkinData as unknown[]).map((s) => skinSchema.parse(s));
export const BUILTIN_SKIN_IDS = builtinSkins.map((s) => s.id);

export const skinSettingsSchema = z
  .object({
    /** A built-in or custom skin id. Null means the dock style's own tokens. */
    active: skinIdSchema.nullable().default(null),
    custom: z.array(skinSchema).max(MAX_CUSTOM_SKINS).default([]),
  })
  .superRefine((value, ctx) => {
    const ids = value.custom.map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "two skins share an id" });
    if (ids.some((id) => BUILTIN_SKIN_IDS.includes(id))) {
      ctx.addIssue({ code: "custom", message: "a custom skin uses a built-in skin's id" });
    }
    if (value.active !== null && !ids.includes(value.active) && !BUILTIN_SKIN_IDS.includes(value.active)) {
      ctx.addIssue({ code: "custom", message: "the active skin doesn't exist", path: ["active"] });
    }
  });

export type SkinSettings = z.infer<typeof skinSettingsSchema>;

export function findSkin(settings: SkinSettings, id: string | null): Skin | undefined {
  if (id === null) return undefined;
  return builtinSkins.find((s) => s.id === id) ?? settings.custom.find((s) => s.id === id);
}

/** CSS custom properties a skin sets for one theme. Values are already validated. */
export function skinVariables(skin: Skin | undefined, theme: "dark" | "light"): Record<string, string> {
  if (!skin) return {};
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(skin[theme])) {
    const spec = skinTokens[token];
    if (!spec) continue;
    switch (spec.kind) {
      case "color":
        vars[spec.var] = String(value);
        break;
      case "length":
        vars[spec.var] = `${value}px`;
        break;
      case "duration":
        vars[spec.var] = `${value}ms`;
        break;
      case "font":
        vars[spec.var] = skinFonts[String(value)];
        if (spec.var === "--od-font") vars["--od-font-display"] = skinFonts[String(value)];
        break;
      case "shadow":
        vars[spec.var] = skinShadows[String(value)];
        vars["--od-shadow-soft"] = skinShadows[String(value)];
        break;
    }
  }
  return vars;
}

export function slugifySkinId(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "skin";
  let id = base;
  for (let n = 2; taken.includes(id); n += 1) id = `${base}-${n}`;
  return id;
}

/**
 * Reads a skin someone pasted or picked. It must be valid as written; only its id is changed
 * when it would clash with a built-in or an existing custom skin.
 */
export function importSkin(text: string, existing: Skin[]): { skin: Skin } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "That isn't valid JSON." };
  }
  const parsed = skinSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return { error: `That skin can't be used. ${where}${issue.message}` };
  }
  const taken = [...BUILTIN_SKIN_IDS, ...existing.map((s) => s.id)];
  const skin = parsed.data;
  return { skin: taken.includes(skin.id) ? { ...skin, id: slugifySkinId(skin.name, taken) } : skin };
}

export function exportSkin(skin: Skin): string {
  return `${JSON.stringify(skin, null, 2)}\n`;
}
