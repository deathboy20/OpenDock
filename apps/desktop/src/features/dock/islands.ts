import type { DockLayout } from "@opendock/config-schema";
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
