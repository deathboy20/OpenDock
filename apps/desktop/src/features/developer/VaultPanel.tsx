import { useState } from "react";
import { errorText, openHub, openVault, vaultCapture } from "../../services/ipc";
import { useLive } from "../../services/liveContext";
import { IconButton, PanelHeader } from "../flyout/panels/PanelHeader";
import { Icon } from "../widgets/icons";
import { PanelState } from "../widgets/visuals";
import { plural } from "./projects";
import "./developer.css";

const MAX_CHARS = 4000;

export function VaultPanel() {
  const { vault } = useLive();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const header = (subtitle?: string) => (
    <PanelHeader
      icon="inbox"
      title="Vault capture"
      subtitle={subtitle}
      actions={<IconButton icon="settings" label="Vault folder" onClick={() => void openHub("developer")} />}
    />
  );

  if (vault.status === "loading") {
    return (
      <>
        {header()}
        <PanelState kind="loading" title="Finding your vault" />
      </>
    );
  }
  if (vault.status === "error") {
    return (
      <>
        {header()}
        <PanelState kind="error" title="Couldn't read the vault" detail={vault.error} />
      </>
    );
  }
  const v = vault.data;
  if (!v.configured || !v.exists) {
    return (
      <>
        {header()}
        <PanelState
          kind={v.configured ? "error" : "empty"}
          title={v.configured ? "The vault folder is missing" : "Choose your vault"}
          detail="Notes go to Inbox/ with today's date as the file name. Nothing leaves this PC."
          action={
            <button type="button" className="button is-primary" onClick={() => void openHub("developer")}>
              Choose folder
            </button>
          }
        />
      </>
    );
  }

  const save = () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    vaultCapture(text)
      .then(() => {
        setText("");
        setSaved(true);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setSaving(false));
  };

  return (
    <>
      {header(`Adds to ${v.todayFile}`)}
      <form
        className="vault-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <textarea
          className="text-area"
          aria-label="Note for your Inbox"
          placeholder="What's on your mind?"
          rows={4}
          maxLength={MAX_CHARS}
          value={text}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              save();
            }
          }}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="button-row vault-actions">
          <span className="muted small" role="status">
            {saved ? "Saved to your Inbox." : "Ctrl+Enter saves"}
          </span>
          <button type="submit" className="button is-primary" disabled={!text.trim() || saving}>
            {saving ? "Saving…" : "Save to Inbox"}
          </button>
        </div>
      </form>
      <section className="panel-section">
        <h2>Today · {plural(v.todayCount, "capture")}</h2>
        {v.recent.length === 0 ? (
          <p className="muted small">Nothing captured yet today.</p>
        ) : (
          <ul className="vault-recent">
            {v.recent.map((entry, i) => (
              <li key={`${i}-${entry}`}>{entry}</li>
            ))}
          </ul>
        )}
      </section>
      <div className="button-row vault-open">
        <button type="button" className="button" onClick={() => void openVault(true).catch((e) => setError(errorText(e)))}>
          <Icon name="note" size={14} /> Today's note
        </button>
        <button type="button" className="button is-ghost" onClick={() => void openVault(false).catch((e) => setError(errorText(e)))}>
          Open in Obsidian
        </button>
      </div>
      {v.isObsidian ? null : (
        <p className="muted small">This folder has no .obsidian settings yet. Open it once in Obsidian to make it a vault.</p>
      )}
    </>
  );
}
