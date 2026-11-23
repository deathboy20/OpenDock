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

describe("island capsules", () => {
  it("spans each island from its first to its last item", async () => {
    const { measureIslands, ISLAND_PAD } = await import("./islands");
    const track = document.createElement("div");
    const item = (edge: string, left: number, width: number) => {
      const el = document.createElement("div");
      el.dataset.island = edge;
      Object.defineProperties(el, {
        offsetLeft: { value: left },
        offsetTop: { value: 0 },
        offsetWidth: { value: width },
        offsetHeight: { value: 36 },
      });
      track.appendChild(el);
    };
    Object.defineProperties(track, { offsetLeft: { value: 8 }, offsetTop: { value: 4 } });
    item("start", 0, 40);
    item("end", 46, 40);
    item("solo", 106, 50);
    expect(measureIslands(track, false)).toEqual([
      { left: 8 - ISLAND_PAD.main, top: 4 - ISLAND_PAD.cross, width: 86 + ISLAND_PAD.main * 2, height: 36 + ISLAND_PAD.cross * 2 },
      { left: 114 - ISLAND_PAD.main, top: 4 - ISLAND_PAD.cross, width: 50 + ISLAND_PAD.main * 2, height: 36 + ISLAND_PAD.cross * 2 },
    ]);
  });
});
