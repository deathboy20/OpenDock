import { describe, expect, it } from "vitest";
import { islandEdges } from "./islands";

const order = ["start", "apps", "clock", "projects", "ci", "volume", "tray", "add-widget"];

describe("dock islands", () => {
  it("keeps one bar when the layout is a bar", () => {
    expect(islandEdges(order, "bar")).toBeNull();
  });

  it("groups neighbours from the same category", () => {
    expect(islandEdges(order, "islands")).toEqual({
      start: "start",
      apps: "middle",
      clock: "end",
      projects: "start",
      ci: "end",
      volume: "start",
      tray: "middle",
      "add-widget": "end",
    });
  });

  it("gives every widget its own chip", () => {
    const edges = islandEdges(["clock", "projects", "add-widget"], "chips");
    expect(edges).toEqual({ clock: "solo", projects: "solo", "add-widget": "solo" });
  });

  it("treats an unknown widget as its own island", () => {
    expect(islandEdges(["clock", "mystery", "media"], "islands")).toEqual({ clock: "solo", mystery: "solo", media: "solo" });
  });
});
