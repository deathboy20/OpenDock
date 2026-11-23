import { describe, expect, it } from "vitest";
import type { UpdateStatus } from "./ipc";
import { updateSummary } from "./updates";

const base: UpdateStatus = { current: "0.3.0", latest: null, available: false, checkedAt: null, error: null };

describe("update summary", () => {
  it("says what to do in plain words", () => {
    expect(updateSummary(null, true)).toBe("OpenDock checks once a day.");
    expect(updateSummary(null, false)).toBe("Automatic checks are off.");
    expect(updateSummary({ ...base, checkedAt: 1 }, true)).toBe("You have the latest version, 0.3.0.");
    expect(
      updateSummary(
        { ...base, available: true, checkedAt: 1, latest: { version: "0.4.0", name: "", url: "", publishedAt: null, notes: "" } },
        true,
      ),
    ).toBe("Version 0.4.0 is ready to download. You have 0.3.0.");
    expect(updateSummary({ ...base, error: "could not reach api.github.com: Dns", checkedAt: 1 }, true)).toBe(
      "Couldn't check: could not reach api.github.com: Dns.",
    );
  });
});
