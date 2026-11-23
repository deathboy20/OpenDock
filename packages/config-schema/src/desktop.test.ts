import { describe, expect, it } from "vitest";
import { desktopSettingsSchema, nextFreeSpot, toggleDesktopWidget } from "./desktop";

describe("desktop widgets", () => {
  it("places new widgets down the left edge", () => {
    expect(nextFreeSpot([], 16)).toEqual({ x: 32, y: 32 });
    expect(nextFreeSpot([{ id: "clock", monitorId: null, x: 32, y: 32 }], 16)).toEqual({ x: 32, y: 128 });
  });

  it("adds and removes a widget, but never dock-only ones", () => {
    const empty = desktopSettingsSchema.parse({});
    const one = toggleDesktopWidget(empty, "clock");
    expect(one.widgets).toEqual([{ id: "clock", monitorId: null, x: 32, y: 32 }]);
    expect(toggleDesktopWidget(one, "clock").widgets).toEqual([]);
    expect(toggleDesktopWidget(empty, "start")).toBe(empty);
  });
});
