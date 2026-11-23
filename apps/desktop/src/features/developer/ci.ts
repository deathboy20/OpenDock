import { githubRepoSchema, trimChars } from "@opendock/config-schema";
import type { CiRepoStatus, CiSnapshot } from "../../services/ipc";

export type CiState = "passing" | "failing" | "running" | "cancelled" | "none" | "error";

export function ciState(repo: CiRepoStatus): CiState {
  if (repo.error) return "error";
  const run = repo.run;
  if (!run) return "none";
  if (run.status !== "completed") return "running";
  switch (run.conclusion) {
    case "success":
    case "neutral":
    case "skipped":
      return "passing";
    case "cancelled":
      return "cancelled";
    default:
      return "failing";
  }
}

/** Words for each state, so the panel never relies on colour alone. */
export const CI_LABEL: Record<CiState, string> = {
  passing: "Passing",
  failing: "Failing",
  running: "Running",
  cancelled: "Cancelled",
  none: "No runs yet",
  error: "Couldn't check",
};

export type CiSummary = Record<CiState, number> & { total: number };

export function summarizeCi(snapshot: CiSnapshot): CiSummary {
  const summary: CiSummary = { total: 0, passing: 0, failing: 0, running: 0, cancelled: 0, none: 0, error: 0 };
  for (const repo of snapshot.repos) {
    summary.total += 1;
    summary[ciState(repo)] += 1;
  }
  return summary;
}

/** What the tile says first: failures, then runs in progress, then errors. */
export function ciHeadline(summary: CiSummary): { text: string; state: CiState } {
  if (summary.failing > 0) return { text: `${summary.failing} failing`, state: "failing" };
  if (summary.running > 0) return { text: `${summary.running} running`, state: "running" };
  if (summary.error > 0 && summary.error === summary.total) return { text: "Couldn't check", state: "error" };
  if (summary.passing > 0) return { text: "All passing", state: "passing" };
  return { text: "No runs yet", state: "none" };
}

/** Accepts `owner/name` or a GitHub URL, and returns `owner/name` or null. */
export function parseRepoInput(input: string): string | null {
  const noSlash = trimChars(input.trim(), "/", "end");
  const trimmed = noSlash.endsWith(".git") ? noSlash.slice(0, -4) : noSlash;
  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+\/[^/]+)/i.exec(trimmed)?.[1];
  const repo = fromUrl ?? trimmed;
  return githubRepoSchema.safeParse(repo).success ? repo : null;
}
