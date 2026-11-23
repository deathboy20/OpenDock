import { useState } from "react";
import { errorText, openCiRun, openHub, refreshCi, type CiRepoStatus } from "../../services/ipc";
import { useLive, useNow } from "../../services/liveContext";
import { useSettings } from "../../services/settingsContext";
import { IconButton, PanelHeader } from "../flyout/panels/PanelHeader";
import { formatAgo } from "../widgets/format";
import { PanelState } from "../widgets/visuals";
import { CI_LABEL, ciState } from "./ci";
import "./developer.css";

function runDetail(repo: CiRepoStatus, now: number): string {
  if (repo.error) return repo.error;
  const run = repo.run;
  if (!run) return "This repository has no Actions runs";
  const when = run.updatedAt ? formatAgo(run.updatedAt, now) : "";
  return [run.workflow, run.branch, when].filter(Boolean).join(" · ");
}

export function CiPanel() {
  const { ci } = useLive();
  const { settings } = useSettings();
  const now = useNow(30_000);
  const [error, setError] = useState<string | null>(null);
  const config = settings.widgets.ci;
  const snapshot = ci.status === "ready" ? ci.data : null;

  const header = (
    <PanelHeader
      icon="pipeline"
      title="CI status"
      subtitle={
        snapshot && snapshot.repos.length > 0
          ? `GitHub Actions · checked ${formatAgo(snapshot.checkedAt, now)}`
          : "GitHub Actions"
      }
      actions={
        <>
          <IconButton icon="refresh" label="Check again" onClick={() => void refreshCi()} />
          <IconButton icon="settings" label="CI settings" onClick={() => void openHub("developer")} />
        </>
      }
    />
  );

  if (!config.enabled || config.repos.length === 0) {
    return (
      <>
        {header}
        <PanelState
          kind="empty"
          title={config.enabled ? "Add a repository" : "CI status is off"}
          detail="Turn it on and list repositories in Developer widgets. OpenDock then asks api.github.com every 5 minutes while this widget is on the dock."
          action={
            <button type="button" className="button is-primary" onClick={() => void openHub("developer")}>
              Set up CI status
            </button>
          }
        />
      </>
    );
  }
  if (ci.status === "error") {
    return (
      <>
        {header}
        <PanelState kind="error" title="Couldn't check CI" detail={ci.error} />
      </>
    );
  }
  if (!snapshot || snapshot.repos.length === 0) {
    return (
      <>
        {header}
        <PanelState kind="loading" title="Asking GitHub" />
      </>
    );
  }

  return (
    <>
      {header}
      <ul className="ci-list" aria-label="Repositories">
        {snapshot.repos.map((repo) => {
          const state = ciState(repo);
          const canOpen = Boolean(repo.run?.url);
          return (
            <li key={repo.repo}>
              <button
                type="button"
                className={`ci-row is-${state}`}
                disabled={!canOpen}
                title={canOpen ? "Open this run on github.com" : undefined}
                onClick={() => {
                  setError(null);
                  openCiRun(repo.repo).catch((e) => setError(errorText(e)));
                }}
              >
                <span className="ci-mark" aria-hidden />
                <span className="ci-repo">{repo.repo}</span>
                <span className="ci-state">{CI_LABEL[state]}</span>
                <span className="ci-detail">{runDetail(repo, now)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {snapshot.hasToken ? null : (
        <p className="muted small">
          Without a token GitHub allows 60 checks an hour and shows public repositories only.
        </p>
      )}
    </>
  );
}
