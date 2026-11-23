import { describe, expect, it } from "vitest";
import {
  builtinSkins,
  exportSkin,
  findSkin,
  importSkin,
  isSkinColor,
  isValidSkinValue,
  skinVariables,
  slugifySkinId,
} from "./skins";

describe("skin values", () => {
  it("accepts only plain colours", () => {
    expect(isSkinColor("#7cf2c8")).toBe(true);
    expect(isSkinColor("rgba(1, 2, 3, .25)")).toBe(true);
    for (const bad of ["red", "#fff", "rgb(0,0,0)", "var(--x)", "url(x)", "#000000;color:red", "rgba(0,0,0,2)"]) {
      expect(isSkinColor(bad), bad).toBe(false);
    }
  });

  it("checks lengths, durations, fonts and shadows", () => {
    expect(isValidSkinValue("radiusLg", 32)).toBe(true);
    expect(isValidSkinValue("radiusLg", 33)).toBe(false);
    expect(isValidSkinValue("motionSlow", 600)).toBe(true);
    expect(isValidSkinValue("font", "mono")).toBe(true);
    expect(isValidSkinValue("font", "Papyrus")).toBe(false);
    expect(isValidSkinValue("shadow", "deep")).toBe(true);
    expect(isValidSkinValue("unknown", "#000000")).toBe(false);
  });
});

describe("built-in skins", () => {
  it("ships five, each with dark and light values", () => {
    expect(builtinSkins.map((s) => s.id)).toEqual(["graphite", "paper", "dusk", "forest", "contrast"]);
    for (const skin of builtinSkins) {
      expect(Object.keys(skin.dark).length, skin.id).toBeGreaterThan(0);
      expect(Object.keys(skin.light).length, skin.id).toBeGreaterThan(0);
    }
  });

  it("turns tokens into CSS variables", () => {
    const contrast = findSkin({ active: null, custom: [] }, "contrast");
    const vars = skinVariables(contrast, "dark");
    expect(vars["--od-accent"]).toBe("#ffd400");
    expect(vars["--od-radius-sm"]).toBe("4px");
    expect(vars["--od-fast"]).toBe("80ms");
    expect(vars["--od-shadow"]).toBe("none");
    expect(skinVariables(undefined, "dark")).toEqual({});
  });
});

describe("import and export", () => {
  it("round-trips a skin", () => {
    const dusk = builtinSkins[2];
    const result = importSkin(exportSkin({ ...dusk, id: "my-dusk", name: "My dusk" }), []);
    expect("skin" in result && result.skin.id).toBe("my-dusk");
  });

  it("renames a skin whose id is taken", () => {
    const result = importSkin(exportSkin(builtinSkins[0]), []);
    expect("skin" in result && result.skin.id).toBe("graphite-2");
  });

  it("explains what's wrong", () => {
    expect(importSkin("{not json", [])).toEqual({ error: "That isn't valid JSON." });
    const bad = importSkin(
      JSON.stringify({ format: "opendock-skin", version: 1, id: "x", name: "X", dark: { accent: "url(x)" } }),
      [],
    );
    expect("error" in bad && bad.error).toContain("dark.accent");
  });

  it("makes ids from names", () => {
    expect(slugifySkinId("Late Night!", [])).toBe("late-night");
    expect(slugifySkinId("Late Night", ["late-night"])).toBe("late-night-2");
    expect(slugifySkinId("***", [])).toBe("skin");
  });
});
