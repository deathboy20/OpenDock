import { MAX_PROJECT_ROOTS, type AppSettings } from "@opendock/config-schema";
import { useState } from "react";
import { useSettings } from "../../services/settingsContext";
import { addFolder } from "../developer/projects";
import { Icon } from "../widgets/icons";
import { PageHeader } from "./PageHeader";

type Change = (fn: (s: AppSettings) => AppSettings) => void;

function ProjectFolders({ settings, change }: { settings: AppSettings; change: Change }) {
  const [draft, setDraft] = useState("");
  const roots = settings.widgets.projects.roots;
  const setRoots = (next: string[]) =>
    change((s) => ({ ...s, widgets: { ...s.widgets, projects: { ...s.widgets.projects, roots: next } } }));
  const full = roots.length >= MAX_PROJECT_ROOTS;
  const submit = () => {
    const next = addFolder(roots, draft);
    if (next !== roots) setRoots(next);
    setDraft("");
  };
  return (
    <section className="settings-card">
      <h2>Project folders</h2>
      <p className="muted small">
        The Projects widget lists git repositories in these folders and one or two levels below. It reads them with
        the <code>git</code> command and only opens projects it found here.
      </p>
      {roots.length > 0 ? (
        <ul className="folder-list" aria-label="Project folders">
          {roots.map((root) => (
            <li key={root}>
              <Icon name="folder" size={14} />
              <span className="mono grow">{root}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${root}`}
                title="Remove"
                onClick={() => setRoots(roots.filter((r) => r !== root))}
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No folders yet. Add the folder your repositories live in, for example D:\Gitfiles.</p>
      )}
      <form
        className="folder-add"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="text-input grow"
          aria-label="Folder path"
          placeholder={full ? `Up to ${MAX_PROJECT_ROOTS} folders` : "D:\\Gitfiles"}
          value={draft}
          maxLength={1024}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="button" disabled={full || !draft.trim()}>
          <Icon name="plus" size={14} /> Add folder
        </button>
      </form>
    </section>
  );
}

export function DeveloperPage() {
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const change: Change = (fn) => void update(fn).then(setError);
  return (
    <div className="page settings-page">
      <PageHeader title="Developer widgets" subtitle="Changes apply straight away." />
      {error ? (
        <p className="callout is-error" role="alert">
          {error}
        </p>
      ) : null}
      <ProjectFolders settings={settings} change={change} />
    </div>
  );
}
