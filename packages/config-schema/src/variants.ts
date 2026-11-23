import variantData from "./widget-variants.json";

/** Ways a widget can draw the same data, from widget-variants.json. The first is the default. */
export const widgetVariants: Record<string, string[]> = Object.fromEntries(
  Object.entries(variantData).filter(([key]) => !key.startsWith("$")),
) as Record<string, string[]>;

export function variantsFor(id: string): string[] {
  return widgetVariants[id] ?? [];
}

export function isValidVariant(id: string, variant: string): boolean {
  return variantsFor(id).includes(variant);
}

/** The variant a widget draws: its own choice if valid, otherwise its default. */
export function resolveVariant(id: string, chosen: string | null | undefined): string | null {
  const list = variantsFor(id);
  if (list.length === 0) return null;
  return chosen && list.includes(chosen) ? chosen : list[0];
}
