import { defaultAppSettings, setWidgetOptions } from "@opendock/config-schema";
import { describe, expect, it } from "vitest";
import { restoreLook } from "./look";

describe("undoing a skin", () => {
  it("puts back the look and keeps everything else", () => {
    const before = setWidgetOptions(defaultAppSettings, "clock", { label: "Time" });
    const applied = {
      ...setWidgetOptions(setWidgetOptions(before, "battery", { variant: "gauge" }), "clock", { variant: "analog" }),
      skins: { ...before.skins, active: "instruments" },
      dock: { ...before.dock, style: "midnight" as const, layout: "islands" as const, tint: "medium" as const, clock24h: true },
    };
    const restored = restoreLook(applied, before);
    expect(restored.skins.active).toBeNull();
    expect(restored.dock.style).toBe(before.dock.style);
    expect(restored.dock.layout).toBe("bar");
    expect(restored.dock.tint).toBe("soft");
    expect(restored.dock.clock24h).toBe(true);
    expect(restored.widgets.options.clock).toEqual({ ...before.widgets.options.clock, variant: null });
    expect(restored.widgets.options.battery.variant).toBeNull();
  });
});
