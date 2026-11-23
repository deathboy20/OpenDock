import { describeScene, MAX_SCENES, SCENE_SUGGESTIONS, type AppSettings } from "@opendock/config-schema";
import { useState } from "react";
import { applyScene, deleteScene, errorText, saveScene } from "../../services/ipc";
import { Icon } from "../widgets/icons";

export function ScenesSection({ settings }: { settings: AppSettings }) {
  const { items, active } = settings.scenes;
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const replaces = items.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());

  const run = (action: Promise<unknown>, done: string) => {
    setMessage(null);
    action.then(() => setMessage({ tone: "ok", text: done })).catch((e) => setMessage({ tone: "error", text: errorText(e) }));
  };

  return (
    <section className="settings-card">
      <h2>Scenes</h2>
      <p className="muted small">
        A scene saves the dock's widgets, size, style, spacing, position, theme and skin, plus quiet hours and
        automations, so you can switch setups in one click. Scenes never change the Windows taskbar.
      </p>
      {items.length > 0 ? (
        <ul className="scene-list" aria-label="Scenes">
          {items.map((scene) => (
            <li key={scene.id} className={scene.id === active ? "is-active" : ""}>
              <div className="scene-text">
                <strong>
                  {scene.name}
                  {scene.id === active ? <span className="badge is-accent">Last applied</span> : null}
                </strong>
                <span className="muted small">{describeScene(scene)}</span>
              </div>
              <button type="button" className="button" onClick={() => run(applyScene(scene.id), `Switched to ${scene.name}.`)}>
                Switch
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Delete ${scene.name}`}
                title="Delete"
                onClick={() => run(deleteScene(scene.id), `Deleted ${scene.name}.`)}
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No scenes yet. Set the dock up the way you like it, then save it here.</p>
      )}
      <form
        className="folder-add"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          run(saveScene(trimmed), replaces ? `Updated ${trimmed} with the current setup.` : `Saved ${trimmed}.`);
          setName("");
        }}
      >
        <input
          className="text-input grow"
          aria-label="Scene name"
          placeholder="Name this setup, for example Work"
          value={name}
          maxLength={40}
          list="scene-suggestions"
          onChange={(e) => setName(e.target.value)}
        />
        <datalist id="scene-suggestions">
          {SCENE_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button type="submit" className="button is-primary" disabled={!name.trim() || (!replaces && items.length >= MAX_SCENES)}>
          {replaces ? "Update scene" : "Save current setup"}
        </button>
      </form>
      {message ? (
        <p className={`callout is-${message.tone} small`} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
