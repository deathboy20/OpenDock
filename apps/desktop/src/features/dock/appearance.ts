import {
  defaultAppSettings,
  type DockPosition,
  type DockSettings,
  type DockSpacing,
} from "@opendock/config-schema";
import { formatTime } from "../widgets/format";
import { DOCK_STYLES } from "./styles";

/** Browser previews pass ?shell= so the hub can show macOS and GNOME Wayland copy.
 * The installed app stays on Windows until platform detection exists. */
export type ShellPlacement = "windows" | "macos" | "gnome-wayland";

const SHELLS: readonly ShellPlacement[] = ["windows", "macos", "gnome-wayland"];

export const SPACING_ORDER: readonly DockSpacing[] = ["tight", "even", "roomy"];

/** Pixels of grip drag that move spacing by one step. */
export const SPACING_DRAG_PX = 24;

const SPACING_LABEL: Record<DockSpacing, string> = {
  tight: "Tight",
  even: "Even",
  roomy: "Roomy",
};

const SIZE_LABEL: Record<DockSettings["size"], string> = {
  s: "small",
  m: "medium",
  l: "large",
};

export function previewShell(search: string): ShellPlacement {
  const value = new URLSearchParams(search).get("shell");
  return SHELLS.includes(value as ShellPlacement) ? (value as ShellPlacement) : "windows";
}

export function shellFloats(shell: ShellPlacement): boolean {
  return shell !== "windows";
}

export function shellNotice(shell: ShellPlacement): string | null {
  if (shell === "gnome-wayland") {
    return "Floating dock. This session can't reserve a screen edge, so the dock sits above it. Not shipped yet.";
  }
  if (shell === "macos") {
    return "This dock floats over the desktop. It does not replace the menu bar. Not shipped yet.";
  }
  return null;
}

const EDGE_INDEX: Record<DockPosition, number> = { left: 0, top: 1, right: 2, bottom: 3 };

export function edgeIndex(edge: DockPosition): number {
  return EDGE_INDEX[edge];
}

export function edgeLabel(edge: DockPosition): string {
  return edge.charAt(0).toUpperCase() + edge.slice(1);
}

export function spacingLabel(spacing: DockSpacing): string {
  return SPACING_LABEL[spacing];
}

export function spacingIndex(spacing: DockSpacing): number {
  return SPACING_ORDER.indexOf(spacing);
}

export function stepSpacing(current: DockSpacing, delta: -1 | 1): DockSpacing {
  const next = spacingIndex(current) + delta;
  return SPACING_ORDER[Math.min(SPACING_ORDER.length - 1, Math.max(0, next))] ?? current;
}

/** Nearest screen edge. An exact tie stays on `current` so the dock does not flicker. */
export function nearestEdge(
  width: number,
  height: number,
  x: number,
  y: number,
  current: DockPosition,
): DockPosition {
  const distance: Record<DockPosition, number> = {
    left: x,
    right: width - x,
    top: y,
    bottom: height - y,
  };
  let best = current;
  for (const edge of ["left", "right", "top", "bottom"] as const) {
    if (distance[edge] < distance[best]) best = edge;
  }
  return best;
}

export function edgeFromArrow(key: string): DockPosition | null {
  switch (key) {
    case "ArrowUp":
      return "top";
    case "ArrowDown":
      return "bottom";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}

export function reorderDelta(key: string): -1 | 1 | null {
  if (key === "ArrowLeft" || key === "ArrowUp") return -1;
  if (key === "ArrowRight" || key === "ArrowDown") return 1;
  return null;
}

export function moveDockItem(order: string[], id: string, delta: -1 | 1): string[] {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  if (!item) return order;
  next.splice(to, 0, item);
  return next;
}

export function resetLook(dock: DockSettings): DockSettings {
  const defaults = defaultAppSettings.dock;
  return {
    ...dock,
    position: defaults.position,
    size: defaults.size,
    mode: defaults.mode,
    theme: defaults.theme,
    style: defaults.style,
    spacing: defaults.spacing,
    clock24h: defaults.clock24h,
  };
}

export function lookIsDefault(dock: DockSettings): boolean {
  const defaults = defaultAppSettings.dock;
  return (
    dock.position === defaults.position &&
    dock.size === defaults.size &&
    dock.mode === defaults.mode &&
    dock.theme === defaults.theme &&
    dock.style === defaults.style &&
    dock.spacing === defaults.spacing &&
    dock.clock24h === defaults.clock24h
  );
}

export function sameDock(a: DockSettings, b: DockSettings): boolean {
  return (
    a.position === b.position &&
    a.size === b.size &&
    a.mode === b.mode &&
    a.theme === b.theme &&
    a.style === b.style &&
    a.spacing === b.spacing &&
    a.clock24h === b.clock24h &&
    a.itemOrder.length === b.itemOrder.length &&
    a.itemOrder.every((id, index) => id === b.itemOrder[index])
  );
}

export function describeDockChange(before: DockSettings, after: DockSettings): string {
  if (before.position !== after.position) return `Moved the dock to the ${after.position}.`;
  if (before.style !== after.style) {
    const label = DOCK_STYLES.find((style) => style.value === after.style)?.label ?? after.style;
    return `Style set to ${label}.`;
  }
  if (before.mode !== after.mode) return after.mode === "pill" ? "Shape set to pill." : "Shape set to full width.";
  if (before.size !== after.size) return `Icon size set to ${SIZE_LABEL[after.size]}.`;
  if (before.spacing !== after.spacing) return `Spacing set to ${spacingLabel(after.spacing)}.`;
  if (before.theme !== after.theme) return after.theme === "dark" ? "Theme set to dark." : "Theme set to light.";
  if (before.clock24h !== after.clock24h) return after.clock24h ? "24-hour clock on." : "24-hour clock off.";
  if (before.itemOrder.some((id, index) => id !== after.itemOrder[index])) return "Reordered the dock.";
  return "Updated the dock.";
}

/** Sample captions so the preview shows the dock's look without waiting on live data. */
export function previewCaption(id: string, clock24h: boolean, now: Date): string | null {
  switch (id) {
    case "clock":
      return formatTime(now, clock24h);
    case "media":
      return "Fusion Jazz";
    case "volume":
      return "64%";
    case "battery":
      return "81%";
    case "system":
      return "42%";
    case "weather":
      return "27°";
    case "calendar":
      return "Design review";
    case "focus":
      return "18:20";
    case "todos":
      return "3 left";
    case "day-progress":
      return "64%";
    default:
      return null;
  }
}

export function previewIsNumeric(id: string): boolean {
  return id === "clock" || id === "volume" || id === "battery" || id === "system" || id === "focus" || id === "weather" || id === "day-progress";
}
