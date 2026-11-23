/** The widget id in a desktop widget window's label (`desk-<id>`). */
export function desktopWidgetId(label: string): string | null {
  const id = label.startsWith("desk-") ? label.slice(5) : "";
  return /^[a-z0-9-]{1,64}$/.test(id) ? id : null;
}

/** A press becomes a drag only after a few pixels, so a click stays a click. */
export function movedFarEnough(from: { x: number; y: number }, to: { x: number; y: number }, threshold = 4): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) >= threshold;
}
