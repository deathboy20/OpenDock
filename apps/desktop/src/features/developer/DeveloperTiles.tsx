import { useLive } from "../../services/liveContext";
import { useSettings } from "../../services/settingsContext";
import { Icon } from "../widgets/icons";
import { Tile, type TileProps } from "../widgets/Tile";
import { plural, projectsHeadline, summarizeProjects } from "./projects";
import "./developer.css";

export function ProjectsTile({ size, compact }: TileProps) {
  const { projects } = useLive();
  const { settings } = useSettings();
  const icon = <Icon name="folder" />;
  if (projects.status !== "ready") {
    return (
      <Tile
        compact={compact}
        state={projects.status}
        icon={icon}
        primary={projects.status === "error" ? "Projects unavailable" : "Projects"}
        title={projects.status === "error" ? projects.error : undefined}
      />
    );
  }
  const snapshot = projects.data;
  if (settings.widgets.projects.roots.length === 0) {
    return <Tile compact={compact} state="empty" icon={icon} primary="Add a folder" title="Choose your project folders" />;
  }
  if (!snapshot) {
    return <Tile compact={compact} state="loading" icon={icon} primary="Projects" />;
  }
  if (!snapshot.gitAvailable) {
    return <Tile compact={compact} state="error" icon={icon} primary="Git not found" title="Install Git to see branches and changes" />;
  }
  if (snapshot.projects.length === 0) {
    return <Tile compact={compact} state="empty" icon={icon} primary="No repos" title="No git repositories in your project folders" />;
  }
  const summary = summarizeProjects(snapshot);
  const headline = projectsHeadline(summary);
  return (
    <Tile
      compact={compact}
      state="ready"
      title={`${plural(summary.total, "repository", "repositories")}: ${headline.toLowerCase()}`}
      icon={
        summary.changed > 0 ? (
          <span className="tile-badge-wrap">
            <Icon name="folder" />
            <span className="tile-count tabular" aria-hidden>
              {summary.changed}
            </span>
          </span>
        ) : (
          icon
        )
      }
      primary={size === "s" ? <span className="tabular">{summary.total} repos</span> : headline}
      secondary={
        size === "s"
          ? undefined
          : size === "l" && summary.behind > 0 && summary.changed > 0
            ? `${summary.total} repos · ${summary.behind} behind`
            : `${summary.total} repos`
      }
    />
  );
}

export function VaultTile({ size, compact }: TileProps) {
  const { vault } = useLive();
  const icon = <Icon name="inbox" />;
  if (vault.status !== "ready") {
    return (
      <Tile
        compact={compact}
        state={vault.status}
        icon={icon}
        primary={vault.status === "error" ? "Vault unavailable" : "Vault"}
        title={vault.status === "error" ? vault.error : undefined}
      />
    );
  }
  const v = vault.data;
  if (!v.configured) {
    return <Tile compact={compact} state="empty" icon={icon} primary="Set your vault" title="Choose your Obsidian vault folder" />;
  }
  if (!v.exists) {
    return <Tile compact={compact} state="error" icon={icon} primary="Vault not found" title="The vault folder is missing" />;
  }
  return (
    <Tile
      compact={compact}
      state="ready"
      icon={icon}
      title={`${plural(v.todayCount, "capture")} in ${v.todayFile}`}
      primary={size === "s" ? "Capture" : v.todayCount === 0 ? "Capture a note" : plural(v.todayCount, "capture")}
      secondary={
        size === "s" ? undefined : size === "l" && v.recent[0] ? <span className="tile-truncate">{v.recent[0]}</span> : "Inbox today"
      }
    />
  );
}
