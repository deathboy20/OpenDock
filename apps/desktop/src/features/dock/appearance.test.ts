import { defaultAppSettings } from "@opendock/config-schema";
import { describe, expect, it } from "vitest";
import {
  describeDockChange,
  edgeFromArrow,
  lookIsDefault,
  moveDockItem,
  nearestEdge,
  previewCaption,
  previewShell,
  resetLook,
  shellNotice,
  stepSpacing,
} from "./appearance";

describe("appearance editor model", () => {
  it("reads the browser shell preview and ignores unknown values", () => {
    expect(previewShell("?shell=macos")).toBe("macos");
    expect(previewShell("?shell=gnome-wayland")).toBe("gnome-wayland");
    expect(previewShell("?shell=kde")).toBe("windows");
    expect(previewShell("")).toBe("windows");
  });

  it("tells the truth about platforms that are not shipped", () => {
    expect(shellNotice("windows")).toBeNull();
    expect(shellNotice("macos")).toMatch(/does not replace the menu bar/);
    expect(shellNotice("macos")).toMatch(/Not shipped yet/);
    expect(shellNotice("macos")).not.toMatch(/taskbar/i);
    expect(shellNotice("gnome-wayland")).toMatch(/can't reserve a screen edge/);
    expect(shellNotice("gnome-wayland")).toMatch(/Not shipped yet/);
  });

  it("picks the nearest edge and keeps the current edge on a tie", () => {
    expect(nearestEdge(200, 80, 100, 70, "top")).toBe("bottom");
    expect(nearestEdge(200, 80, 4, 40, "bottom")).toBe("left");
    expect(nearestEdge(100, 100, 50, 50, "right")).toBe("right");
  });

  it("maps arrow keys onto edges", () => {
    expect(edgeFromArrow("ArrowLeft")).toBe("left");
    expect(edgeFromArrow("Enter")).toBeNull();
  });

  it("steps spacing and stops at the ends", () => {
    expect(stepSpacing("even", 1)).toBe("roomy");
    expect(stepSpacing("roomy", 1)).toBe("roomy");
    expect(stepSpacing("tight", -1)).toBe("tight");
  });

  it("moves a widget by one place and refuses the ends", () => {
    expect(moveDockItem(["start", "clock", "tray"], "clock", -1)).toEqual(["clock", "start", "tray"]);
    expect(moveDockItem(["start", "clock"], "start", -1)).toEqual(["start", "clock"]);
  });

  it("resets the look and leaves the widget order alone", () => {
    const dock = {
      ...defaultAppSettings.dock,
      style: "ink" as const,
      position: "left" as const,
      spacing: "roomy" as const,
      itemOrder: ["clock", "media"],
      launchAtStartup: true,
    };
    expect(lookIsDefault(dock)).toBe(false);
    const reset = resetLook(dock);
    expect(lookIsDefault(reset)).toBe(true);
    expect(reset.itemOrder).toEqual(["clock", "media"]);
    expect(reset.launchAtStartup).toBe(true);
  });

  it("names one change", () => {
    const before = defaultAppSettings.dock;
    expect(describeDockChange(before, { ...before, position: "left" })).toBe("Moved the dock to the left.");
    expect(describeDockChange(before, { ...before, spacing: "tight" })).toBe("Spacing set to Tight.");
    expect(describeDockChange(before, { ...before, itemOrder: ["clock", "start"] })).toBe("Reordered the dock.");
  });

  it("shows a real clock and the sample track", () => {
    const afternoon = new Date(2026, 9, 31, 15, 4);
    expect(previewCaption("media", false, afternoon)).toBe("Fusion Jazz");
    expect(previewCaption("clock", true, afternoon)).toContain("15");
    expect(previewCaption("clock", false, afternoon)).not.toContain("15");
  });
});
