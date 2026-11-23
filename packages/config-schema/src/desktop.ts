import { z } from "zod";

/**
 * The desktop widgets layer: widgets in their own borderless windows behind other windows.
 * Positions are logical px relative to the monitor's top-left, snapped to `grid`.
 * Mirrors `settings/desktop.rs`.
 */
export const MAX_DESKTOP_WIDGETS = 12;
/** Widgets that are part of the dock itself and make no sense on their own. */
export const DOCK_ONLY_WIDGETS = ["start", "apps", "tray", "volume", "add-widget"];

const offset = z.number().int().min(-16_384).max(16_384);

export const desktopWidgetSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .refine((id) => !DOCK_ONLY_WIDGETS.includes(id), "this widget only lives on the dock"),
  /** The monitor's name, as Windows reports it. Null means the primary monitor. */
  monitorId: z.string().max(256).nullable().default(null),
  x: offset,
  y: offset,
});

export const desktopSettingsSchema = z.object({
  grid: z.number().int().min(8).max(64).default(16),
  widgets: z
    .array(desktopWidgetSchema)
    .max(MAX_DESKTOP_WIDGETS)
    .refine((list) => new Set(list.map((w) => w.id)).size === list.length, "a widget is on the desktop twice")
    .default([]),
});

export type DesktopWidget = z.infer<typeof desktopWidgetSchema>;
export type DesktopSettings = z.infer<typeof desktopSettingsSchema>;

/** Where a newly placed widget starts: down the left edge, one row per widget. Rust snaps it
 * to the grid and keeps it on screen when the user moves it. */
export function nextFreeSpot(existing: DesktopWidget[], grid: number): { x: number; y: number } {
  const g = Math.min(64, Math.max(8, grid));
  const row = Math.max(Math.round(76 / g) * g, g) + g;
  const start = g * 2;
  let y = start;
  while (existing.some((w) => w.x === start && w.y === y)) y += row;
  return { x: start, y };
}

export function toggleDesktopWidget(desktop: DesktopSettings, id: string): DesktopSettings {
  if (desktop.widgets.some((w) => w.id === id)) {
    return { ...desktop, widgets: desktop.widgets.filter((w) => w.id !== id) };
  }
  if (desktop.widgets.length >= MAX_DESKTOP_WIDGETS || DOCK_ONLY_WIDGETS.includes(id)) return desktop;
  const spot = nextFreeSpot(desktop.widgets, desktop.grid);
  return { ...desktop, widgets: [...desktop.widgets, { id, monitorId: null, ...spot }] };
}
