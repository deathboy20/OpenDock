import { describe, expect, it } from "vitest";
import { slugifyRuleId } from "./rules";
import { slugifySkinId } from "./skins";
import { slugify, trimChars } from "./text";

describe("trimChars", () => {
  it("trims a set of characters from either end", () => {
    expect(trimChars("--a-b--", "-")).toBe("a-b");
    expect(trimChars("D:\\Gitfiles\\//", "\\/", "end")).toBe("D:\\Gitfiles");
    expect(trimChars("//x//", "/", "start")).toBe("x//");
    expect(trimChars("----", "-")).toBe("");
    expect(trimChars("", "-")).toBe("");
  });

  it("stays fast on long runs of the same character", () => {
    const hostile = `${"-".repeat(200_000)}x${"-".repeat(200_000)}!`;
    const started = performance.now();
    expect(trimChars(hostile, "-!")).toBe("x");
    expect(slugify(hostile, 32, "fallback")).toBe("x");
    expect(slugifySkinId(hostile, [])).toBe("x");
    expect(slugifyRuleId(hostile, [])).toBe("x");
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("slugify", () => {
  it("joins letters and digits with single dashes", () => {
    expect(slugify("  Late Night!! ", 32, "skin")).toBe("late-night");
    expect(slugify("***", 32, "skin")).toBe("skin");
    expect(slugify("abc def", 4, "x")).toBe("abc");
  });
});
