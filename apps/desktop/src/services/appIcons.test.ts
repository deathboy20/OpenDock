import { describe, expect, it } from "vitest";
import { ICON_RETRY_MS, shouldRefetch } from "./appIcons";

describe("app icon cache", () => {
  it("keeps found icons and retries missing ones a few times", () => {
    expect(shouldRefetch(undefined, 0)).toBe(true);
    expect(shouldRefetch({ url: "data:x", at: 0, tries: 1 }, 10 * ICON_RETRY_MS)).toBe(false);
    expect(shouldRefetch({ url: null, at: 0, tries: 1 }, ICON_RETRY_MS - 1)).toBe(false);
    expect(shouldRefetch({ url: null, at: 0, tries: 1 }, ICON_RETRY_MS)).toBe(true);
    expect(shouldRefetch({ url: null, at: 0, tries: 4 }, 10 * ICON_RETRY_MS)).toBe(false);
  });
});
