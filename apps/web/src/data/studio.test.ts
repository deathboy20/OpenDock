import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dockLayouts, dockSkins, filterApps, nextFrontApp, studioApps, studioWallpapers } from "./studio";

const stylesSource = readFileSync(
  new URL("../../../../apps/desktop/src/features/dock/styles.ts", import.meta.url),
  "utf8",
);

describe("browser dock playground", () => {
  it("offers the same skins as the desktop app, in the same order", () => {
    const values = [...stylesSource.matchAll(/value: "([^"]+)"/g)].map((match) => match[1]);
    expect(dockSkins.map((skin) => skin.id)).toEqual(values);
  });

  it("offers the same dock layouts as the desktop app", () => {
    const settings = readFileSync(new URL("../../../../packages/config-schema/src/settings.ts", import.meta.url), "utf8");
    const values = /dockLayoutSchema = z\.enum\(\[([^\]]+)\]\)/.exec(settings)?.[1] ?? "";
    expect(dockLayouts.map((layout) => layout.id)).toEqual([...values.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  });

  it("has a description for every wallpaper", () => {
    expect(studioWallpapers.map((w) => w.id)).toEqual(["evening", "bright", "busy"]);
    expect(studioWallpapers.every((w) => w.description.length > 0)).toBe(true);
  });

  it("filters apps by name and keeps the full list for a blank query", () => {
    expect(filterApps(studioApps, "   ")).toEqual([...studioApps]);
    expect(filterApps(studioApps, "no").map((app) => app.id)).toEqual(["notes"]);
    expect(filterApps(studioApps, "zzz")).toEqual([]);
  });

  it("brings a clicked app forward and minimises it on a second click", () => {
    expect(nextFrontApp(null, "files")).toBe("files");
    expect(nextFrontApp("files", "notes")).toBe("notes");
    expect(nextFrontApp("notes", "notes")).toBeNull();
  });
});
