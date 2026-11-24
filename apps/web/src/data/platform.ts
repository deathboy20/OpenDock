import type { PlatformId } from "./releases";

export type DetectedPlatform = PlatformId | "other";

export type NavigatorHints = {
  /** `navigator.userAgentData.platform`, where the browser has it. */
  uaPlatform?: string;
  /** `navigator.platform`, deprecated but still filled in by every browser. */
  platform?: string;
  userAgent?: string;
  /** `navigator.maxTouchPoints`. iPads report a Mac user agent, and this is the only way to tell. */
  touchPoints?: number;
};

/** Guesses the visitor's desktop system. Phones, tablets and Chromebooks get "other". */
export function detectPlatform(hints: NavigatorHints): DetectedPlatform {
  const text = [hints.uaPlatform, hints.platform, hints.userAgent].filter(Boolean).join(" ");
  if (/android|iphone|ipad|ipod|cros/i.test(text)) return "other";
  if (/win/i.test(text)) return "windows";
  if (/mac/i.test(text)) return (hints.touchPoints ?? 0) > 1 ? "other" : "macos";
  if (/linux|x11/i.test(text)) return "linux";
  return "other";
}
