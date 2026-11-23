import type { WidgetAccent, WidgetLayout } from "@opendock/config-schema";

/** Widgets whose data is checked on a timer, with the default and the fastest allowed. */
export const POLLING: Record<string, { defaultSeconds: number; minSeconds: number; why?: string }> = {
  projects: { defaultSeconds: 120, minSeconds: 30 },
  "local-ai": { defaultSeconds: 60, minSeconds: 15 },
  ci: { defaultSeconds: 300, minSeconds: 60, why: "GitHub allows 60 checks an hour without a token." },
};

export const LAYOUTS: { value: WidgetLayout; label: string }[] = [
  { value: "auto", label: "Dock size" },
  { value: "compact", label: "Icon only" },
  { value: "detailed", label: "Detailed" },
];

export const ACCENTS: { value: WidgetAccent; label: string }[] = [
  { value: "theme", label: "Theme" },
  { value: "mint", label: "Mint" },
  { value: "sky", label: "Sky" },
  { value: "amber", label: "Amber" },
  { value: "rose", label: "Rose" },
  { value: "violet", label: "Violet" },
];

/** Refresh presets in seconds, filtered to what the widget allows. */
export function refreshChoices(id: string): number[] {
  const polling = POLLING[id];
  if (!polling) return [];
  return [15, 30, 60, 120, 300, 600, 1800].filter((s) => s >= polling.minSeconds);
}

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = seconds / 60;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}

/** The interval the Rust service will actually use, mirroring `services::refresh_interval`. */
export function effectiveRefresh(id: string, refreshSeconds: number | null): number | null {
  const polling = POLLING[id];
  if (!polling) return null;
  return refreshSeconds === null ? polling.defaultSeconds : Math.max(refreshSeconds, polling.minSeconds);
}
