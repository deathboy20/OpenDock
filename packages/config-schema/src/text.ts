/**
 * Removes any of `chars` from both ends (or one end) of `text`, in linear time. Used instead of
 * regular expressions like `/-+$/`, whose backtracking can take polynomial time on long runs
 * of the same character in user input.
 */
export function trimChars(text: string, chars: string, side: "both" | "start" | "end" = "both"): string {
  let start = 0;
  let end = text.length;
  if (side !== "end") while (start < end && chars.includes(text[start])) start += 1;
  if (side !== "start") while (end > start && chars.includes(text[end - 1])) end -= 1;
  return text.slice(start, end);
}

/** Lowercase letters and digits joined by single dashes, at most `max` long, or `fallback`. */
export function slugify(name: string, max: number, fallback: string): string {
  const dashed = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return trimChars(trimChars(dashed, "-").slice(0, max), "-") || fallback;
}
