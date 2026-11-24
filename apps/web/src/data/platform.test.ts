import { describe, expect, it } from "vitest";
import { detectPlatform } from "./platform";

describe("detectPlatform", () => {
  it("prefers the client hint when the browser sends one", () => {
    expect(detectPlatform({ uaPlatform: "Windows", platform: "Win32" })).toBe("windows");
    expect(detectPlatform({ uaPlatform: "macOS", platform: "MacIntel" })).toBe("macos");
    expect(detectPlatform({ uaPlatform: "Linux", platform: "Linux x86_64" })).toBe("linux");
  });

  it("falls back to the platform and user agent strings", () => {
    expect(
      detectPlatform({
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15",
      }),
    ).toBe("macos");
    expect(
      detectPlatform({ userAgent: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0" }),
    ).toBe("linux");
  });

  it("does not offer desktop builds to phones, tablets or Chromebooks", () => {
    expect(
      detectPlatform({ platform: "Linux armv8l", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0" }),
    ).toBe("other");
    expect(detectPlatform({ platform: "iPhone", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)" })).toBe(
      "other",
    );
    expect(detectPlatform({ platform: "Linux x86_64", userAgent: "Mozilla/5.0 (X11; CrOS x86_64 15917.71.0)" })).toBe(
      "other",
    );
    expect(detectPlatform({ platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", touchPoints: 5 })).toBe(
      "other",
    );
    expect(detectPlatform({})).toBe("other");
  });
});
