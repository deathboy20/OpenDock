import type { AppSettings } from "@opendock/config-schema";

/**
 * Puts back what applying a skin can change (the active skin, dock style, layout, thickness,
 * tint and each widget's look) from `before`, and keeps everything else as it is now. Used by
 * Undo after a skin is applied.
 */
export function restoreLook(current: AppSettings, before: AppSettings): AppSettings {
  const options = { ...current.widgets.options };
  const ids = new Set([...Object.keys(options), ...Object.keys(before.widgets.options)]);
  for (const id of ids) {
    const previous = before.widgets.options[id]?.variant ?? null;
    const now = options[id];
    if (!now) {
      if (previous !== null) options[id] = { ...before.widgets.options[id] };
      continue;
    }
    options[id] = { ...now, variant: previous };
  }
  return {
    ...current,
    skins: { ...current.skins, active: before.skins.active },
    dock: {
      ...current.dock,
      style: before.dock.style,
      layout: before.dock.layout,
      density: before.dock.density,
      tint: before.dock.tint,
    },
    widgets: { ...current.widgets, options },
  };
}
