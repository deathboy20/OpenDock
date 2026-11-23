import { describe, expect, it } from "vitest";
import { describeScene, sceneSettingsSchema, type Scene } from "./scenes";

const work: Scene = {
  id: "work",
  name: "Work",
  dock: { itemOrder: ["start", "projects", "add-widget"], size: "m", style: "glass", spacing: "even", position: "bottom" },
  theme: "dark",
  skin: "graphite",
  quietHours: false,
  automations: true,
};

describe("scenes", () => {
  it("describes what a scene changes", () => {
    expect(describeScene(work)).toBe("2 widgets · glass dark · graphite skin");
    expect(describeScene({ ...work, skin: null, quietHours: true, automations: false, dock: { ...work.dock, itemOrder: ["clock"] } })).toBe(
      "1 widget · glass dark · quiet hours on · automations off",
    );
  });

  it("requires the active scene to exist", () => {
    expect(sceneSettingsSchema.safeParse({ items: [work], active: "work" }).success).toBe(true);
    expect(sceneSettingsSchema.safeParse({ items: [], active: "work" }).success).toBe(false);
  });
});
