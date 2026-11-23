import type { Project, ProjectsSnapshot } from "../../services/ipc";

export type ProjectsSummary = { total: number; changed: number; behind: number; ahead: number; failed: number };

export function summarizeProjects(snapshot: ProjectsSnapshot): ProjectsSummary {
  const summary: ProjectsSummary = { total: 0, changed: 0, behind: 0, ahead: 0, failed: 0 };
  for (const project of snapshot.projects) {
    summary.total += 1;
    if (project.error) summary.failed += 1;
    if (project.dirty > 0) summary.changed += 1;
    if ((project.behind ?? 0) > 0) summary.behind += 1;
    if ((project.ahead ?? 0) > 0) summary.ahead += 1;
  }
  return summary;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The tile's headline: what needs attention first. */
export function projectsHeadline(summary: ProjectsSummary): string {
  if (summary.changed > 0) return `${summary.changed} with changes`;
  if (summary.behind > 0) return `${summary.behind} behind`;
  return "All clean";
}

export function branchLabel(project: Project): string {
  if (project.detached) return "detached";
  return project.branch ?? "no branch";
}

/** Plain words for a repo's state, so the list never relies on colour. */
export function projectStatus(project: Project): string {
  if (project.error) return project.error;
  const parts: string[] = [];
  if (project.dirty > 0) parts.push(plural(project.dirty, "change"));
  if ((project.ahead ?? 0) > 0) parts.push(`${project.ahead} ahead`);
  if ((project.behind ?? 0) > 0) parts.push(`${project.behind} behind`);
  if (parts.length === 0) return project.upstream ? "Clean, up to date" : "Clean, no upstream";
  return parts.join(", ");
}

export function filterProjects(projects: Project[], query: string): Project[] {
  const q = query.trim().toLowerCase();
  if (!q) return projects;
  return projects.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.branch ?? "").toLowerCase().includes(q),
  );
}

/** The folder a project sits in, relative to its root, for telling same-named repos apart. */
export function projectLocation(project: Project): string {
  const rel = project.path.slice(project.root.length).replace(/^[\\/]+/, "");
  const parent = rel.split(/[\\/]/).slice(0, -1).join("/");
  return parent ? `${parent}/` : "";
}

/** Adds a folder path to a list, ignoring case and trailing slashes. */
export function addFolder(list: string[], input: string): string[] {
  const trimmed = input.trim().replace(/[\\/]+$/, "");
  // "D:" alone means the current folder on drive D, so a drive root keeps its backslash.
  const folder = /^[A-Za-z]:$/.test(trimmed) ? `${trimmed}\\` : trimmed;
  if (!folder || list.some((f) => f.toLowerCase() === folder.toLowerCase())) return list;
  return [...list, folder];
}
