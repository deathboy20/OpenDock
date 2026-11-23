import { MAX_CI_REPOS, MAX_PROJECT_ROOTS, trimChars, type AppSettings } from "@opendock/config-schema";
import { useEffect, useState } from "react";
import {
  clearGithubToken,
  errorText,
  getCiStatus,
  getVaultStatus,
  on,
  setGithubToken,
  type VaultStatus,
} from "../../services/ipc";
import { useSettings } from "../../services/settingsContext";
import { parseRepoInput } from "../developer/ci";
import { addFolder } from "../developer/projects";
import { Icon } from "../widgets/icons";
import { Row, Toggle } from "./controls";
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

function VaultFolder({ settings, change }: { settings: AppSettings; change: Change }) {
  const saved = settings.widgets.vault.path;
  const [draft, setDraft] = useState(saved);
  const [seen, setSeen] = useState(saved);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  if (saved !== seen) {
    setSeen(saved);
    setDraft(saved);
  }
  useEffect(() => {
    let cancelled = false;
    getVaultStatus()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus(null));
    return () => {
      cancelled = true;
    };
  }, [saved]);
  const commit = () => {
    const path = trimChars(draft.trim(), "\\/", "end");
    if (path === saved) return;
    change((s) => ({ ...s, widgets: { ...s.widgets, vault: { ...s.widgets.vault, path } } }));
  };
  const hint = !saved
    ? "Captures go to Inbox/YYYY-MM-DD.md inside this folder. OpenDock writes nothing else there."
    : status && !status.exists
      ? "That folder doesn't exist."
      : status && !status.isObsidian
        ? "Found the folder, but it has no .obsidian settings yet. Open it once in Obsidian."
        : `Captures go to ${status?.todayFile ?? "Inbox/"} inside this folder.`;
  return (
    <section className="settings-card">
      <h2>Vault capture</h2>
      <form
        className="folder-add"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <input
          className="text-input grow"
          aria-label="Obsidian vault folder"
          placeholder="C:\Users\you\Documents\Vault"
          value={draft}
          maxLength={1024}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="button" disabled={draft.trim() === saved}>
          Save
        </button>
      </form>
      <p className={`small ${status && saved && !status.exists ? "text-warn" : "muted"}`}>{hint}</p>
    </section>
  );
}

function CiSection({ settings, change }: { settings: AppSettings; change: Change }) {
  const ci = settings.widgets.ci;
  const [draft, setDraft] = useState("");
  const [repoError, setRepoError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const setCi = (patch: Partial<AppSettings["widgets"]["ci"]>) =>
    change((s) => ({ ...s, widgets: { ...s.widgets, ci: { ...s.widgets.ci, ...patch } } }));

  useEffect(() => {
    const load = () =>
      void getCiStatus()
        .then((s) => setHasToken(s?.hasToken ?? false))
        .catch(() => setHasToken(null));
    load();
    return on("ci:update", (s) => setHasToken(s.hasToken));
  }, []);

  const addRepo = () => {
    const repo = parseRepoInput(draft);
    if (!repo) {
      setRepoError("Use owner/name, for example deathboy20/OpenDock, or paste the GitHub link.");
      return;
    }
    setRepoError(null);
    setDraft("");
    if (!ci.repos.some((r) => r.toLowerCase() === repo.toLowerCase())) setCi({ repos: [...ci.repos, repo] });
  };
  const saveToken = () => {
    setTokenMessage(null);
    setGithubToken(token)
      .then(() => {
        setToken("");
        setHasToken(true);
        setTokenMessage("Saved in Windows Credential Manager.");
      })
      .catch((e) => setTokenMessage(errorText(e)));
  };

  return (
    <section className="settings-card">
      <h2>CI status</h2>
      <Row
        label="Check GitHub Actions"
        hint="Off by default. When on, OpenDock asks api.github.com for the latest run of each repository every 5 minutes while the widget is on the dock."
      >
        <Toggle label="Check GitHub Actions" checked={ci.enabled} onChange={(enabled) => setCi({ enabled })} />
      </Row>
      {ci.repos.length > 0 ? (
        <ul className="folder-list" aria-label="CI repositories">
          {ci.repos.map((repo) => (
            <li key={repo}>
              <Icon name="pipeline" size={14} />
              <span className="mono grow">{repo}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${repo}`}
                title="Remove"
                onClick={() => setCi({ repos: ci.repos.filter((r) => r !== repo) })}
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="folder-add"
        onSubmit={(e) => {
          e.preventDefault();
          addRepo();
        }}
      >
        <input
          className="text-input grow"
          aria-label="Repository"
          placeholder={ci.repos.length >= MAX_CI_REPOS ? `Up to ${MAX_CI_REPOS} repositories` : "owner/name"}
          value={draft}
          maxLength={200}
          disabled={ci.repos.length >= MAX_CI_REPOS}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="button" disabled={!draft.trim() || ci.repos.length >= MAX_CI_REPOS}>
          <Icon name="plus" size={14} /> Add repository
        </button>
      </form>
      {repoError ? <p className="small text-warn">{repoError}</p> : null}

      <Row
        label="GitHub token"
        hint={
          hasToken
            ? "A token is saved in Windows Credential Manager. It is never shown again or written to a file."
            : "Optional. Needed for private repositories and more than 60 checks an hour. Use a fine-grained token with read-only Actions access."
        }
      >
        <form
          className="folder-add token-form"
          onSubmit={(e) => {
            e.preventDefault();
            saveToken();
          }}
        >
          <input
            className="text-input grow"
            type="password"
            autoComplete="off"
            aria-label="GitHub token"
            placeholder={hasToken ? "Replace the saved token" : "github_pat_…"}
            value={token}
            maxLength={255}
            onChange={(e) => setToken(e.target.value)}
          />
          <button type="submit" className="button" disabled={!token.trim()}>
            Save token
          </button>
          {hasToken ? (
            <button
              type="button"
              className="button is-danger"
              onClick={() =>
                void clearGithubToken()
                  .then(() => {
                    setHasToken(false);
                    setTokenMessage("Token removed.");
                  })
                  .catch((e) => setTokenMessage(errorText(e)))
              }
            >
              Remove
            </button>
          ) : null}
        </form>
      </Row>
      {tokenMessage ? (
        <p className="muted small" role="status">
          {tokenMessage}
        </p>
      ) : null}
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
      <VaultFolder settings={settings} change={change} />
      <CiSection settings={settings} change={change} />
    </div>
  );
}
