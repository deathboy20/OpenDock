import { z } from "zod";

/**
 * Scenes: saved setups that switch the dock's widgets, look, skin, quiet hours and
 * automations together. Rust saves and applies them (`settings/scenes.rs`); this schema
 * mirrors its validation. A scene never changes the taskbar mode.
 */
export const MAX_SCENES = 12;

const sceneIdSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/);
const itemIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/);

export const sceneSchema = z.object({
  id: sceneIdSchema,
  name: z.string().trim().min(1).max(40),
  dock: z.object({
    itemOrder: z
      .array(itemIdSchema)
      .min(1)
      .max(32)
      .refine((ids) => new Set(ids).size === ids.length, "a scene repeats a dock item"),
    size: z.enum(["s", "m", "l"]),
    style: z.enum(["glass", "solid", "midnight", "minimal", "neon", "ink"]),
    spacing: z.enum(["tight", "even", "roomy"]),
    position: z.enum(["top", "bottom", "left", "right"]),
  }),
  theme: z.enum(["dark", "light"]),
  skin: sceneIdSchema.nullable().default(null),
  quietHours: z.boolean(),
  automations: z.boolean(),
});

export const sceneSettingsSchema = z
  .object({
    items: z.array(sceneSchema).max(MAX_SCENES).default([]),
    /** The scene applied last, if any. */
    active: sceneIdSchema.nullable().default(null),
  })
  .superRefine((value, ctx) => {
    const ids = value.items.map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "two scenes share an id" });
    if (value.active !== null && !ids.includes(value.active)) {
      ctx.addIssue({ code: "custom", message: "the active scene doesn't exist", path: ["active"] });
    }
  });

export type Scene = z.infer<typeof sceneSchema>;
export type SceneSettings = z.infer<typeof sceneSettingsSchema>;

export const SCENE_SUGGESTIONS = ["Work", "Focus", "Present", "Evening"];

/** Plain words for what a scene changes, for its card. */
export function describeScene(scene: Scene): string {
  const widgets = scene.dock.itemOrder.filter((id) => id !== "add-widget").length;
  return [
    `${widgets} widget${widgets === 1 ? "" : "s"}`,
    `${scene.dock.style} ${scene.theme}`,
    scene.skin ? `${scene.skin} skin` : null,
    scene.quietHours ? "quiet hours on" : null,
    scene.automations ? null : "automations off",
  ]
    .filter(Boolean)
    .join(" · ");
}
