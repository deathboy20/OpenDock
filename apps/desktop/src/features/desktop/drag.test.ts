import { describe, expect, it } from "vitest";
import { desktopWidgetId, movedFarEnough } from "./drag";

describe("desktop widget windows", () => {
  it("reads the widget id from the window label", () => {
    expect(desktopWidgetId("desk-clock")).toBe("clock");
    expect(desktopWidgetId("desk-local-ai")).toBe("local-ai");
    expect(desktopWidgetId("main")).toBeNull();
    expect(desktopWidgetId("desk-")).toBeNull();
    expect(desktopWidgetId("desk-../hub")).toBeNull();
  });

  it("starts a drag only after the pointer moves", () => {
    expect(movedFarEnough({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
    expect(movedFarEnough({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(true);
  });
});
