import { useEffect, useState } from "react";
import {
  errorText,
  openHub,
  openProject,
  readHandoff,
  refreshProjects,
  type Project,
  type ProjectTool,
} from "../../services/ipc";
import { useLive, useNow } from "../../services/liveContext";
import { useSettings } from "../../services/settingsContext";
import { IconButton, PanelHeader } from "../flyout/panels/PanelHeader";
import { formatAgo } from "../widgets/format";
import { Icon } from "../widgets/icons";
import { PanelState } from "../widgets/visuals";
import { MarkdownView } from "./MarkdownView";
import {
  branchLabel,
  filterProjects,
  plural,
  projectLocation,
  projectStatus,
  summarizeProjects,
} from "./projects";
import "./developer.css";

const TOOLS: { tool: ProjectTool; label: string }[] = [
  { tool: "cursor", label: "Cursor" },
  { tool: "vscode", label: "VS Code" },
  { tool: "terminal", label: "Terminal" },
  { tool: "githubDesktop", label: "GitHub Desktop" },
  { tool: "explorer", label: "Files" },
];

function ProjectRow({
  project,
  expanded,
  onToggle,
  onHandoff,
}: {
  project: Project;
  expanded: boolean;
  onToggle: () => void;
  onHandoff: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const attention = project.error ? "is-error" : project.dirty > 0 ? "is-changed" : "";
  const open = (tool: ProjectTool) => {
    setError(null);
    openProject(project.path, tool).catch((e) => setError(errorText(e)));
  };
  return (
    <li className={`project-row ${expanded ? "is-expanded" : ""} ${attention}`}>
      <button type="button" className="project-main" aria-expanded={expanded} onClick={onToggle}>
        <span className="project-name">
          <span className="muted">{projectLocation(project)}</span>
          {project.name}
        </span>
        <span className="project-branch mono">
          <Icon name="branch" size={12} />
          {branchLabel(project)}
        </span>
        <span className="project-status">{projectStatus(project)}</span>
      </button>
      {expanded ? (
        <div className="project-actions">
          {TOOLS.map(({ tool, label }) => (
            <button key={tool} type="button" className="chip-button" onClick={() => open(tool)}>
              {label}
            </button>
          ))}
          {project.hasHandoff ? (
            <button type="button" className="chip-button is-accent" onClick={onHandoff}>
              <Icon name="note" size={12} /> HANDOFF.md
            </button>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function HandoffView({ project, onBack }: { project: Project; onBack: () => void }) {
  const [state, setState] = useState<{ text: string | null; error: string | null; loaded: boolean }>({
    text: null,
    error: null,
    loaded: false,
  });
  useEffect(() => {
    let cancelled = false;
    readHandoff(project.path)
      .then((text) => !cancelled && setState({ text, error: null, loaded: true }))
      .catch((e) => !cancelled && setState({ text: null, error: errorText(e), loaded: true }));
    return () => {
      cancelled = true;
    };
  }, [project.path]);
  return (
    <>
      <PanelHeader
        icon="note"
        title="HANDOFF.md"
        subtitle={project.name}
        actions={<IconButton icon="back" label="Back to projects" onClick={onBack} />}
      />
      {!state.loaded ? (
        <PanelState kind="loading" title="Reading HANDOFF.md" />
      ) : state.error ? (
        <PanelState kind="error" title="Couldn't read HANDOFF.md" detail={state.error} />
      ) : state.text === null || state.text.trim() === "" ? (
        <PanelState kind="empty" title="This handoff is empty" detail="Add one at the project root so the next session can pick up." />
      ) : (
        <MarkdownView source={state.text} />
      )}
    </>
  );
}

export function ProjectsPanel() {
  const { projects } = useLive();
  const { settings } = useSettings();
  const now = useNow(30_000);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<Project | null>(null);
  const roots = settings.widgets.projects.roots;

  if (handoff) {
    return <HandoffView project={handoff} onBack={() => setHandoff(null)} />;
  }

  const snapshot = projects.status === "ready" ? projects.data : null;
  const summary = snapshot ? summarizeProjects(snapshot) : null;
  const header = (
    <PanelHeader
      icon="folder"
      title="Projects"
      subtitle={
        summary && snapshot
          ? `${plural(summary.total, "repo")} · ${summary.changed} with changes · checked ${formatAgo(snapshot.scannedAt, now)}`
          : roots.length > 0
            ? roots.join(", ")
            : undefined
      }
      actions={
        <>
          <IconButton icon="refresh" label="Check again" onClick={() => void refreshProjects()} />
          <IconButton icon="settings" label="Project folders" onClick={() => void openHub("developer")} />
        </>
      }
    />
  );

  if (roots.length === 0) {
    return (
      <>
        {header}
        <PanelState
          kind="empty"
          title="Choose your project folders"
          detail="OpenDock lists the git repositories inside them. Nothing leaves this PC."
          action={
            <button type="button" className="button is-primary" onClick={() => void openHub("developer")}>
              Choose folders
            </button>
          }
        />
      </>
    );
  }
  if (projects.status === "error") {
    return (
      <>
        {header}
        <PanelState kind="error" title="Couldn't list projects" detail={projects.error} />
      </>
    );
  }
  if (!snapshot) {
    return (
      <>
        {header}
        <PanelState kind="loading" title="Looking for repositories" />
      </>
    );
  }
  if (!snapshot.gitAvailable) {
    return (
      <>
        {header}
        <PanelState kind="error" title="Git isn't installed" detail="Install Git for Windows, then check again." />
      </>
    );
  }

  const visible = filterProjects(snapshot.projects, query);
  return (
    <>
      {header}
      {snapshot.missingRoots.length > 0 ? (
        <p className="callout is-warn small" role="status">
          <Icon name="warning" size={14} /> Not found: {snapshot.missingRoots.join(", ")}
        </p>
      ) : null}
      {snapshot.projects.length === 0 ? (
        <PanelState
          kind="empty"
          title="No git repositories here"
          detail="OpenDock looks in each folder and one or two levels below it."
        />
      ) : (
        <>
          {snapshot.projects.length > 6 ? (
            <div className="search-field project-search">
              <Icon name="search" size={14} />
              <input
                type="search"
                aria-label="Filter projects"
                placeholder="Filter by name or branch"
                value={query}
                maxLength={80}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : null}
          {visible.length === 0 ? (
            <p className="muted small project-none">No project matches “{query.trim()}”.</p>
          ) : (
            <ul className="project-list" aria-label="Projects">
              {visible.map((project) => (
                <ProjectRow
                  key={project.path}
                  project={project}
                  expanded={expanded === project.path}
                  onToggle={() => setExpanded((current) => (current === project.path ? null : project.path))}
                  onHandoff={() => setHandoff(project)}
                />
              ))}
            </ul>
          )}
          {snapshot.truncated ? <p className="muted small">Showing the first {snapshot.projects.length} repositories.</p> : null}
        </>
      )}
    </>
  );
}
