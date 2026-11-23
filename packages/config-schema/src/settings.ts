import { z } from "zod";
import { isValidVariant } from "./variants";
import { desktopSettingsSchema } from "./desktop";
import { sceneSettingsSchema } from "./scenes";
import { skinSettingsSchema } from "./skins";

export const SETTINGS_VERSION = 7;
export const MAX_PINNED_APPS = 24;
export const MAX_PROJECT_ROOTS = 8;
export const MAX_CI_REPOS = 10;

export const dockPositionSchema = z.enum(["top", "bottom", "left", "right"]);
export const dockSizeSchema = z.enum(["s", "m", "l"]);
export const dockModeSchema = z.enum(["pill", "full"]);
export const themeSchema = z.enum(["dark", "light"]);
export const dockStyleSchema = z.enum(["glass", "solid", "midnight", "minimal", "neon", "ink"]);
/** One bar, separate capsules for runs of related widgets, or a capsule per widget. */
export const dockLayoutSchema = z.enum(["bar", "islands", "chips"]);
/** Slim makes the dock thinner without changing icon size choices. */
export const dockDensitySchema = z.enum(["regular", "slim"]);
/** How opaque the dock's surface is; stronger reads better on bright or busy wallpapers. */
export const dockTintSchema = z.enum(["soft", "medium", "strong"]);
/** Gap between dock items, independent of icon size. */
export const dockSpacingSchema = z.enum(["tight", "even", "roomy"]);
/** "replace" hides the taskbar and lets the dock reserve its screen edge instead. */
export const taskbarModeSchema = z.enum(["normal", "autohide", "hidden", "replace"]);
export const startActionSchema = z.enum(["launcher", "windows"]);
export const temperatureUnitSchema = z.enum(["c", "f"]);

const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

export const dockItemIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);

export const DEFAULT_ITEM_ORDER = ["start", "apps", "media", "clock", "volume", "tray", "add-widget"];

export const dockSettingsSchema = z.object({
  position: dockPositionSchema.default("bottom"),
  size: dockSizeSchema.default("m"),
  mode: dockModeSchema.default("pill"),
  theme: themeSchema.default("dark"),
  style: dockStyleSchema.default("glass"),
  spacing: dockSpacingSchema.default("even"),
  layout: dockLayoutSchema.default("bar"),
  density: dockDensitySchema.default("regular"),
  tint: dockTintSchema.default("soft"),
  monitorId: z.string().max(256).nullable().default(null),
  itemOrder: z
    .array(dockItemIdSchema)
    .min(1)
    .max(32)
    .refine((ids) => new Set(ids).size === ids.length, "itemOrder must not repeat ids")
    .default(DEFAULT_ITEM_ORDER),
  clock24h: z.boolean().default(false),
  launchAtStartup: z.boolean().default(false),
  autoHideInFullscreen: z.boolean().default(true),
  startAction: startActionSchema.default("launcher"),
});

export const pinnedAppSchema = z.object({
  name: z.string().trim().min(1).max(120),
  path: z.string().min(1).max(1024),
  target: z.string().max(1024).nullable().default(null),
});

export const appsSettingsSchema = z.object({
  pinned: z
    .array(pinnedAppSchema)
    .max(MAX_PINNED_APPS)
    .refine(
      (apps) => new Set(apps.map((a) => a.path.toLowerCase())).size === apps.length,
      "an app is pinned twice",
    )
    .default([]),
  groupWindows: z.boolean().default(true),
  showTitles: z.boolean().default(false),
});

export const taskbarSettingsSchema = z.object({
  mode: taskbarModeSchema.default("normal"),
});

export const weatherSettingsSchema = z.object({
  city: z.string().max(120).default(""),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  unit: temperatureUnitSchema.default("c"),
});

export const focusSettingsSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180).default(25),
  breakMinutes: z.number().int().min(1).max(60).default(5),
});

const folderPathSchema = z.string().trim().min(1).max(1024);

export const projectsSettingsSchema = z.object({
  /** Folders whose git repositories the Projects widget lists, one or two levels deep. */
  roots: z
    .array(folderPathSchema)
    .max(MAX_PROJECT_ROOTS)
    .refine((roots) => new Set(roots.map((r) => r.toLowerCase())).size === roots.length, "a folder is listed twice")
    .default([]),
});

export const vaultSettingsSchema = z.object({
  /** The Obsidian vault the capture box writes to. Empty until the user picks one. */
  path: z.string().trim().max(1024).default(""),
});

export const localAiSettingsSchema = z.object({
  /** The Ollama model quick prompts go to. Empty means the first installed model. */
  model: z.string().trim().max(128).default(""),
});

/** `owner/name`, as GitHub allows them. */
export const githubRepoSchema = z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/, "expected owner/name")
  .refine((repo) => !/\/\.{1,2}$/.test(repo), "expected owner/name");

export const ciSettingsSchema = z.object({
  /** Off by default: CI status is the only developer widget that leaves the device. */
  enabled: z.boolean().default(false),
  repos: z
    .array(githubRepoSchema)
    .max(MAX_CI_REPOS)
    .refine((repos) => new Set(repos.map((r) => r.toLowerCase())).size === repos.length, "a repository is listed twice")
    .default([]),
});

/** How a widget fills its dock slot: follow the dock size, icon only, or the large layout. */
export const widgetLayoutSchema = z.enum(["auto", "compact", "detailed"]);
/** Accent swatches from tokens.css. "theme" keeps the dock's accent. */
export const widgetAccentSchema = z.enum(["theme", "mint", "sky", "amber", "rose", "violet"]);
export const MAX_WIDGET_OPTIONS = 40;

export const widgetOptionsSchema = z.object({
  /** Shown as the widget's name in tooltips and panel titles. Empty uses the widget's own name. */
  label: z.string().trim().max(40).default(""),
  layout: widgetLayoutSchema.default("auto"),
  accent: widgetAccentSchema.default("theme"),
  /** Seconds between checks for widgets that poll. Null uses the widget's own default. */
  refreshSeconds: z.number().int().min(15).max(3600).nullable().default(null),
  /** How the widget draws its data (see widget-variants.json). Null uses its default. */
  variant: z.string().max(32).nullable().default(null),
});

export const widgetSettingsSchema = z.object({
  /** Options per dock widget, keyed by widget id. */
  options: z
    .record(dockItemIdSchema, widgetOptionsSchema)
    .refine((options) => Object.keys(options).length <= MAX_WIDGET_OPTIONS, "too many widget options")
    .refine(
      (options) => Object.entries(options).every(([id, o]) => o.variant === null || isValidVariant(id, o.variant)),
      "a widget uses a variant it doesn't have",
    )
    .default({}),
  weather: weatherSettingsSchema.default({}),
  focus: focusSettingsSchema.default({}),
  projects: projectsSettingsSchema.default({}),
  vault: vaultSettingsSchema.default({}),
  localAi: localAiSettingsSchema.default({}),
  ci: ciSettingsSchema.default({}),
});

export const quietHoursSchema = z.object({
  enabled: z.boolean().default(false),
  start: clockTimeSchema.default("22:00"),
  end: clockTimeSchema.default("07:00"),
});

export const automationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  quietHours: quietHoursSchema.default({}),
});

export const appSettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  dock: dockSettingsSchema,
  taskbar: taskbarSettingsSchema.default({}),
  widgets: widgetSettingsSchema.default({}),
  automation: automationSettingsSchema.default({}),
  apps: appsSettingsSchema.default({}),
  skins: skinSettingsSchema.default({}),
  scenes: sceneSettingsSchema.default({}),
  desktop: desktopSettingsSchema.default({}),
  updates: z
    .object({
      /** Ask GitHub once a day whether a newer OpenDock release exists. Nothing else is sent. */
      check: z.boolean().default(true),
    })
    .default({}),
  /** False until the first-run welcome has been completed or skipped. */
  onboarded: z.boolean().default(false),
});

export type DockPosition = z.infer<typeof dockPositionSchema>;
export type DockSize = z.infer<typeof dockSizeSchema>;
export type DockMode = z.infer<typeof dockModeSchema>;
export type DockStyle = z.infer<typeof dockStyleSchema>;
export type DockSpacing = z.infer<typeof dockSpacingSchema>;
export type DockLayout = z.infer<typeof dockLayoutSchema>;
export type DockDensity = z.infer<typeof dockDensitySchema>;
export type DockTint = z.infer<typeof dockTintSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type TaskbarMode = z.infer<typeof taskbarModeSchema>;
export type StartAction = z.infer<typeof startActionSchema>;
export type PinnedApp = z.infer<typeof pinnedAppSchema>;
export type AppsSettings = z.infer<typeof appsSettingsSchema>;
export type DockSettings = z.infer<typeof dockSettingsSchema>;
export type WeatherSettings = z.infer<typeof weatherSettingsSchema>;
export type FocusSettings = z.infer<typeof focusSettingsSchema>;
export type QuietHours = z.infer<typeof quietHoursSchema>;
export type ProjectsSettings = z.infer<typeof projectsSettingsSchema>;
export type VaultSettings = z.infer<typeof vaultSettingsSchema>;
export type LocalAiSettings = z.infer<typeof localAiSettingsSchema>;
export type CiSettings = z.infer<typeof ciSettingsSchema>;
export type WidgetLayout = z.infer<typeof widgetLayoutSchema>;
export type WidgetAccent = z.infer<typeof widgetAccentSchema>;
export type WidgetOptions = z.infer<typeof widgetOptionsSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultAppSettings: AppSettings = appSettingsSchema.parse({
  version: SETTINGS_VERSION,
  dock: {},
});

export function parseAppSettings(input: unknown): AppSettings {
  return appSettingsSchema.parse(input);
}

/** Upgrades older settings documents to the current version before validation. Mirrors
 * `AppSettings::migrate` in Rust. */
export function migrateAppSettings(input: unknown): AppSettings {
  if (typeof input !== "object" || input === null) {
    return parseAppSettings(input);
  }
  const doc = input as { version?: unknown; dock?: { itemOrder?: unknown } };
  // Version 4 added dock styles, version 5 spacing (even), version 6 the developer widgets
  // (projects, vault, local AI and CI, all empty or off), version 7 per-widget options,
  // skins, scenes and desktop widgets (all empty). Each defaults on parse.
  if (doc.version === 3 || doc.version === 4 || doc.version === 5 || doc.version === 6) {
    return parseAppSettings({ ...doc, version: SETTINGS_VERSION });
  }
  if (doc.version !== 1 && doc.version !== 2) {
    return parseAppSettings(input);
  }
  let dock = doc.dock;
  const order = dock?.itemOrder;
  if (Array.isArray(order) && order.length < 32 && !order.includes("apps")) {
    const at = order.indexOf("start") + 1;
    const next = [...order];
    next.splice(at, 0, "apps");
    dock = { ...dock, itemOrder: next };
  }
  return parseAppSettings({ ...doc, dock, version: SETTINGS_VERSION, onboarded: true });
}

export function pinApp(pinned: PinnedApp[], app: PinnedApp): PinnedApp[] {
  const key = app.path.toLowerCase();
  if (pinned.some((p) => p.path.toLowerCase() === key) || pinned.length >= MAX_PINNED_APPS) {
    return pinned;
  }
  return [...pinned, app];
}

export function unpinApp(pinned: PinnedApp[], path: string): PinnedApp[] {
  const key = path.toLowerCase();
  return pinned.filter((p) => p.path.toLowerCase() !== key);
}

export function movePinnedApp(pinned: PinnedApp[], path: string, offset: -1 | 1): PinnedApp[] {
  const from = pinned.findIndex((p) => p.path.toLowerCase() === path.toLowerCase());
  const to = from + offset;
  if (from < 0 || to < 0 || to >= pinned.length) {
    return pinned;
  }
  const next = [...pinned];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function reorderDockItems(order: string[], activeId: string, overId: string): string[] {
  if (activeId === overId) {
    return order;
  }
  const from = order.indexOf(activeId);
  const to = order.indexOf(overId);
  if (from < 0 || to < 0) {
    return order;
  }
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}

export function addDockItem(order: string[], id: string): string[] {
  if (order.includes(id)) {
    return order;
  }
  const addIndex = order.indexOf("add-widget");
  const next = [...order];
  next.splice(addIndex < 0 ? next.length : addIndex, 0, id);
  return next;
}

export function removeDockItem(order: string[], id: string): string[] {
  const next = order.filter((item) => item !== id);
  return next.length === 0 ? ["add-widget"] : next;
}

export const defaultWidgetOptions: WidgetOptions = widgetOptionsSchema.parse({});

export function widgetOptionsFor(settings: AppSettings, id: string): WidgetOptions {
  return settings.widgets.options[id] ?? defaultWidgetOptions;
}

/** Sets one widget's options, dropping the entry when it is back to the defaults. */
export function setWidgetOptions(settings: AppSettings, id: string, patch: Partial<WidgetOptions>): AppSettings {
  const next = { ...widgetOptionsFor(settings, id), ...patch };
  const options = { ...settings.widgets.options };
  const isDefault = (Object.keys(defaultWidgetOptions) as (keyof WidgetOptions)[]).every(
    (key) => next[key] === defaultWidgetOptions[key],
  );
  if (isDefault) delete options[id];
  else options[id] = next;
  return { ...settings, widgets: { ...settings.widgets, options } };
}
