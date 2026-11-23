import type { DockLayout } from "@opendock/config-schema";
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { ADD_WIDGET_ID, findWidget } from "../widgets/catalog";

export type IslandEdge = "solo" | "start" | "middle" | "end";

/**
 * Where each dock item sits in its island. Islands are runs of neighbouring widgets from the
 * same gallery category, so Start and Apps share one and the developer widgets another; the
 * add button joins the island before it. In the chips layout every widget is its own island.
 */
export function islandEdges(order: string[], layout: DockLayout): Record<string, IslandEdge> | null {
  if (layout === "bar") return null;
  const groups: string[][] = [];
  let previous: string | null = null;
  for (const id of order) {
    const group: string | null = id === ADD_WIDGET_ID ? previous : (findWidget(id)?.category ?? `unknown:${id}`);
    const last = groups[groups.length - 1];
    if (layout === "islands" && last && group === previous) last.push(id);
    else groups.push([id]);
    previous = group;
  }
  const edges: Record<string, IslandEdge> = {};
  for (const group of groups) {
    group.forEach((id, i) => {
      edges[id] = group.length === 1 ? "solo" : i === 0 ? "start" : i === group.length - 1 ? "end" : "middle";
    });
  }
  return edges;
}

export type IslandRect = { left: number; top: number; width: number; height: number };

/** How far an island's capsule reaches past its first and last item, and above and below. */
export const ISLAND_PAD = { main: 6, cross: 5 };

/**
 * Measures each island from its first to its last item, relative to the dock shell, so it can
 * be drawn as one capsule behind the track: one blur and one border, with no seams.
 */
export function measureIslands(track: HTMLElement, vertical: boolean): IslandRect[] {
  const rects: IslandRect[] = [];
  // Items are positioned inside the track, which sits inside the shell the capsules use.
  const base = { x: track.offsetLeft, y: track.offsetTop };
  let start: HTMLElement | null = null;
  for (const child of Array.from(track.children) as HTMLElement[]) {
    const edge = child.dataset.island as IslandEdge | undefined;
    if (!edge) continue;
    if (edge === "start" || edge === "solo") start = child;
    if ((edge === "end" || edge === "solo") && start) {
      const from = start;
      const to = child;
      if (vertical) {
        rects.push({
          left: base.x + from.offsetLeft - ISLAND_PAD.cross,
          top: base.y + from.offsetTop - ISLAND_PAD.main,
          width: from.offsetWidth + ISLAND_PAD.cross * 2,
          height: to.offsetTop + to.offsetHeight - from.offsetTop + ISLAND_PAD.main * 2,
        });
      } else {
        rects.push({
          left: base.x + from.offsetLeft - ISLAND_PAD.main,
          top: base.y + from.offsetTop - ISLAND_PAD.cross,
          width: to.offsetLeft + to.offsetWidth - from.offsetLeft + ISLAND_PAD.main * 2,
          height: from.offsetHeight + ISLAND_PAD.cross * 2,
        });
      }
      start = null;
    }
  }
  return rects;
}

/** Keeps island capsules measured while the track's items change size. */
export function useIslandRects(
  trackRef: RefObject<HTMLElement | null>,
  vertical: boolean,
  enabled: boolean,
  key: string,
): IslandRect[] {
  const [rects, setRects] = useState<IslandRect[]>([]);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track) {
      setRects([]);
      return;
    }
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRects(measureIslands(track, vertical)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(frame);
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    Array.from(track.children).forEach((child) => observer.observe(child));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [trackRef, vertical, enabled, key]);
  return rects;
}

/** The island capsules, drawn behind the dock track. */
export function islandStyle(rect: IslandRect): CSSProperties {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}
