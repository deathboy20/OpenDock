import {
  builtinSkins,
  findSkin,
  exportSkin,
  importSkin,
  MAX_CUSTOM_SKINS,
  type AppSettings,
  type Skin,
} from "@opendock/config-schema";
import { useRef, useState, type CSSProperties } from "react";
import { applySkin, errorText } from "../../services/ipc";
import { useSettings } from "../../services/settingsContext";
import { Icon } from "../widgets/icons";
import { restoreLook } from "./look";
import { contrastProblems, previewColors } from "./skinChecks";


export function SkinCard({
  skin,
  theme,
  active,
  onPick,
}: {
  skin: Skin | undefined;
  theme: "dark" | "light";
  active: boolean;
  onPick: () => void;
}) {
  const colors = previewColors(skin, theme);
  // Preview colours come from validated skin values or the base theme tokens.
  const style = {
    "--preview-surface": colors.surface,
    "--preview-text": colors.text,
    "--preview-muted": colors.muted,
    "--preview-accent": colors.accent,
    "--preview-ink": colors.ink,
  } as CSSProperties;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={`skin-card ${active ? "is-active" : ""}`}
      onClick={onPick}
    >
      <span className="skin-preview" style={style} aria-hidden>
        <span className="skin-preview-line" />
        <span className="skin-preview-line is-short" />
        <span className="skin-preview-pill">Aa</span>
      </span>
      <strong>{skin?.name ?? "Dock style"}</strong>
      <span className="muted small">{skin?.description || (skin ? "Your skin" : "The colours of the dock style you picked")}</span>
      {interfaceSummary(skin) ? <span className="chip skin-chip">{interfaceSummary(skin)}</span> : null}
    </button>
  );
}

/** Words for what a skin's interface changes, shown on its card. */
function interfaceSummary(skin: Skin | undefined): string | null {
  const i = skin?.interface;
  if (!i) return null;
  const parts = [
    i.layout === "islands" ? "Islands" : i.layout === "chips" ? "Chips" : i.layout === "bar" ? "One bar" : null,
    i.density === "slim" ? "Slim" : null,
    i.tint === "strong" ? "Strong tint" : i.tint === "medium" ? "Medium tint" : null,
    i.variants && Object.keys(i.variants).length > 0 ? `${Object.keys(i.variants).length} widget looks` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function SkinsSection({ settings }: { settings: AppSettings }) {
  const { update } = useSettings();
  const change = (fn: (s: AppSettings) => AppSettings) => void update(fn);
  const { active, custom } = settings.skins;
  const theme = settings.dock.theme;
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [exported, setExported] = useState<Skin | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [undo, setUndo] = useState<{ before: AppSettings; name: string } | null>(null);

  const setActive = (id: string | null) => {
    const before = settings;
    const name = id === null ? "the dock style" : (findSkin(settings.skins, id)?.name ?? id);
    void applySkin(id)
      .then(() => setUndo({ before, name }))
      .catch((e) => setMessage({ tone: "error", text: errorText(e) }));
  };

  const add = (text: string) => {
    if (custom.length >= MAX_CUSTOM_SKINS) {
      setMessage({ tone: "error", text: `You can keep up to ${MAX_CUSTOM_SKINS} skins. Delete one first.` });
      return;
    }
    const result = importSkin(text, custom);
    if ("error" in result) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    const skin = result.skin;
    void update((s) => ({ ...s, skins: { ...s.skins, custom: [...s.skins.custom, skin] } })).then((error) => {
      if (error) setMessage({ tone: "error", text: error });
      else setActive(skin.id);
    });
    setImportText("");
    const problems = contrastProblems(skin);
    setMessage(
      problems.length > 0
        ? {
            tone: "warn",
            text: `Added ${skin.name}. Some text may be hard to read: ${problems
              .map((p) => `${p.pair.toLowerCase()} in ${p.theme} is ${p.ratio}:1 (needs ${p.needed}:1)`)
              .join("; ")}.`,
          }
        : { tone: "ok", text: `Added ${skin.name} and switched to it.` },
    );
  };

  const remove = (id: string) =>
    change((s) => ({
      ...s,
      skins: { active: s.skins.active === id ? null : s.skins.active, custom: s.skins.custom.filter((k) => k.id !== id) },
    }));

  return (
    <section className="settings-card">
      <h2>Skins</h2>
      <p className="muted small">
        A skin changes colours, corners, blur, shadows, font and motion, and can set the dock's shape and each widget's
        look. You can still change any of it afterwards. Skins are JSON files of settings and design tokens only, so they
        can't run code or load anything from the internet.
      </p>
      <div className="skin-grid" role="radiogroup" aria-label="Skin">
        <SkinCard skin={undefined} theme={theme} active={active === null} onPick={() => setActive(null)} />
        {[...builtinSkins, ...custom].map((skin) => (
          <SkinCard key={skin.id} skin={skin} theme={theme} active={active === skin.id} onPick={() => setActive(skin.id)} />
        ))}
      </div>

      {undo ? (
        <p className="callout is-ok small skin-undo" role="status">
          <span>Switched to {undo.name}.</span>
          <button
            type="button"
            className="button is-ghost"
            onClick={() => {
              const { before } = undo;
              setUndo(null);
              void update((s) => restoreLook(s, before));
            }}
          >
            <Icon name="undo" size={14} /> Undo
          </button>
        </p>
      ) : null}

      {custom.length > 0 ? (
        <ul className="folder-list" aria-label="Your skins">
          {custom.map((skin) => (
            <li key={skin.id}>
              <Icon name="palette" size={14} />
              <span className="grow">{skin.name}</span>
              <button type="button" className="button is-ghost" onClick={() => setExported(skin)}>
                Export
              </button>
              <button type="button" className="icon-button" aria-label={`Delete ${skin.name}`} title="Delete" onClick={() => remove(skin.id)}>
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="skin-io">
        <label className="option-field">
          <span className="small">Import a skin</span>
          <textarea
            className="text-area mono"
            rows={4}
            placeholder='{ "format": "opendock-skin", "version": 1, "id": "…", "name": "…", "dark": { "accent": "#…" } }'
            value={importText}
            maxLength={20_000}
            onChange={(e) => setImportText(e.target.value)}
          />
        </label>
        <div className="button-row">
          <button type="button" className="button is-primary" disabled={!importText.trim()} onClick={() => add(importText)}>
            Add skin
          </button>
          <button type="button" className="button" onClick={() => fileRef.current?.click()}>
            <Icon name="import" size={14} /> Open a .json file
          </button>
          <button
            type="button"
            className="button is-ghost"
            onClick={() => setExported(findSkin(settings.skins, active) ?? null)}
            disabled={active === null}
          >
            Export the current skin
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 20_000) {
                setMessage({ tone: "error", text: "That file is too big to be a skin." });
                return;
              }
              void file.text().then(add);
            }}
          />
        </div>
        {message ? (
          <p className={`callout is-${message.tone} small`} role={message.tone === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        ) : null}
      </div>

      {exported ? (
        <div className="skin-io">
          <label className="option-field">
            <span className="small">{exported.name} as JSON</span>
            <textarea className="text-area mono" rows={8} readOnly value={exportSkin(exported)} />
          </label>
          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(exportSkin(exported))
                  .then(() => setMessage({ tone: "ok", text: `Copied ${exported.name}. Paste it into a .json file to share it.` }))
                  .catch(() => setMessage({ tone: "error", text: "Couldn't copy. Select the text and copy it instead." }))
              }
            >
              Copy
            </button>
            <button type="button" className="button is-ghost" onClick={() => setExported(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
