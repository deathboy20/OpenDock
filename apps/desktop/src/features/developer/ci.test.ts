import { describe, expect, it } from "vitest";
import type { CiRepoStatus, CiRun } from "../../services/ipc";
import { ciHeadline, ciState, parseRepoInput, summarizeCi } from "./ci";

const run: CiRun = {
  workflow: "CI",
  branch: "main",
  event: "push",
  status: "completed",
  conclusion: "success",
  url: "https://github.com/o/r/actions/runs/1",
  updatedAt: 0,
};
const repo = (patch: Partial<CiRun> | null, error: string | null = null): CiRepoStatus => ({
  repo: "o/r",
  run: patch === null ? null : { ...run, ...patch },
  error,
});

describe("CI model", () => {
  it("reads each run's state", () => {
    expect(ciState(repo({}))).toBe("passing");
    expect(ciState(repo({ conclusion: "skipped" }))).toBe("passing");
    expect(ciState(repo({ conclusion: "failure" }))).toBe("failing");
    expect(ciState(repo({ conclusion: "timed_out" }))).toBe("failing");
    expect(ciState(repo({ conclusion: "cancelled" }))).toBe("cancelled");
    expect(ciState(repo({ status: "in_progress", conclusion: null }))).toBe("running");
    expect(ciState(repo(null))).toBe("none");
    expect(ciState(repo(null, "Not found"))).toBe("error");
  });

  it("puts failures first in the headline", () => {
    const snapshot = (repos: CiRepoStatus[]) => summarizeCi({ enabled: true, hasToken: false, repos, checkedAt: 0 });
    expect(ciHeadline(snapshot([repo({}), repo({ conclusion: "failure" }), repo({ status: "queued" })]))).toEqual({
      text: "1 failing",
      state: "failing",
    });
    expect(ciHeadline(snapshot([repo({}), repo({ status: "queued" })])).text).toBe("1 running");
    expect(ciHeadline(snapshot([repo({}), repo(null, "x")])).text).toBe("All passing");
    expect(ciHeadline(snapshot([repo(null, "x")])).state).toBe("error");
    expect(ciHeadline(snapshot([repo(null)])).text).toBe("No runs yet");
  });

  it("accepts owner/name or a GitHub link", () => {
    expect(parseRepoInput(" deathboy20/OpenDock ")).toBe("deathboy20/OpenDock");
    expect(parseRepoInput("https://github.com/deathboy20/OpenDock/actions")).toBe("deathboy20/OpenDock");
    expect(parseRepoInput("github.com/o/r.git")).toBe("o/r");
    expect(parseRepoInput("OpenDock")).toBeNull();
    expect(parseRepoInput("o/..")).toBeNull();
    expect(parseRepoInput("https://gitlab.com/o/r")).toBeNull();
  });
});
