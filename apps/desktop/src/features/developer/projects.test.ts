import { describe, expect, it } from "vitest";
import type { Project } from "../../services/ipc";
import { parseMarkdown } from "./markdown";
import {
  addFolder,
  branchLabel,
  filterProjects,
  projectLocation,
  projectsHeadline,
  projectStatus,
  summarizeProjects,
} from "./projects";

const base: Project = {
  name: "OpenDock",
  path: "D:\\Gitfiles\\OpenDock",
  root: "D:\\Gitfiles",
  branch: "main",
  detached: false,
  upstream: "origin/main",
  ahead: 0,
  behind: 0,
  dirty: 0,
  hasHandoff: true,
  error: null,
};

describe("projects model", () => {
  it("summarises what needs attention", () => {
    const summary = summarizeProjects({
      projects: [base, { ...base, name: "a", dirty: 3 }, { ...base, name: "b", behind: 2, ahead: 1 }],
      missingRoots: [],
      truncated: false,
      gitAvailable: true,
      scannedAt: 0,
    });
    expect(summary).toEqual({ total: 3, changed: 1, behind: 1, ahead: 1, failed: 0 });
    expect(projectsHeadline(summary)).toBe("1 with changes");
    expect(projectsHeadline({ ...summary, changed: 0 })).toBe("1 behind");
    expect(projectsHeadline({ ...summary, changed: 0, behind: 0 })).toBe("All clean");
  });

  it("describes a repo in words", () => {
    expect(projectStatus(base)).toBe("Clean, up to date");
    expect(projectStatus({ ...base, upstream: null })).toBe("Clean, no upstream");
    expect(projectStatus({ ...base, dirty: 1, ahead: 2, behind: 3 })).toBe("1 change, 2 ahead, 3 behind");
    expect(projectStatus({ ...base, error: "not a git repository" })).toBe("not a git repository");
    expect(branchLabel({ ...base, detached: true, branch: null })).toBe("detached");
  });

  it("filters by name or branch and shows nested folders", () => {
    const soko = { ...base, name: "map-dashboard", path: "D:\\Gitfiles\\SOKO\\map-dashboard", branch: "staging" };
    expect(filterProjects([base, soko], "STAG").map((p) => p.name)).toEqual(["map-dashboard"]);
    expect(filterProjects([base, soko], " ")).toHaveLength(2);
    expect(projectLocation(soko)).toBe("SOKO/");
    expect(projectLocation(base)).toBe("");
  });
});

describe("project folders", () => {
  it("adds each folder once and keeps drive roots usable", () => {
    expect(addFolder([], "  D:\\Gitfiles\\ ")).toEqual(["D:\\Gitfiles"]);
    expect(addFolder(["D:\\Gitfiles"], "d:\\gitfiles")).toEqual(["D:\\Gitfiles"]);
    expect(addFolder([], "D:\\")).toEqual(["D:\\"]);
    expect(addFolder([], "   ")).toEqual([]);
  });
});

describe("markdown reading view", () => {
  it("turns a handoff into plain blocks", () => {
    const blocks = parseMarkdown(
      "# Handoff\r\n\r\nSome **bold** text\nwith a [link](https://x.y).\n\n## Next\n- [x] done\n  - nested `code`\n1. first\n\n```\nnpm test\n```\n<script>alert(1)</script>",
    );
    expect(blocks).toEqual([
      { kind: "heading", level: 1, text: "Handoff" },
      { kind: "paragraph", text: "Some bold text with a link." },
      { kind: "heading", level: 2, text: "Next" },
      { kind: "item", depth: 0, checked: true, text: "done" },
      { kind: "item", depth: 1, checked: null, text: "nested code" },
      { kind: "item", depth: 0, checked: null, text: "first" },
      { kind: "code", text: "npm test" },
      { kind: "paragraph", text: "<script>alert(1)</script>" },
    ]);
  });

  it("caps very long notes", () => {
    expect(parseMarkdown("- a\n".repeat(1000), 50)).toHaveLength(50);
  });
});
