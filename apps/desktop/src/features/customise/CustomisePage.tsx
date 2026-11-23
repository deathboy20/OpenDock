import { setWidgetOptions, widgetOptionsFor, type AppSettings } from "@opendock/config-schema";
import { useState } from "react";
import { useSettings } from "../../services/settingsContext";
import { Choice } from "../hub/controls";
import { PageHeader } from "../hub/PageHeader";
import { ADD_WIDGET_ID, findWidget } from "../widgets/catalog";
import { Icon } from "../widgets/icons";
import { SkinsSection } from "./SkinsSection";
import { ACCENTS, effectiveRefresh, formatSeconds, LAYOUTS, POLLING, refreshChoices } from "./widgetOptions";
import "./customise.css";

type Change = (fn: (s: AppSettings) => AppSettings) => void;

function LabelInput({ id, value, fallback, change }: { id: string; value: string; fallback: string; change: Change }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft.trim() !== value) change((s) => setWidgetOptions(s, id, { label: draft.trim() }));
  };
  return (
    <input
      className="text-input"
      aria-label={`Label for ${fallback}`}
      placeholder={fallback}
      value={draft}
      maxLength={40}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

function WidgetOptionsRow({ id, settings, change }: { id: string; settings: AppSettings; change: Change }) {
  const [open, setOpen] = useState(false);
  const widget = findWidget(id);
  const options = widgetOptionsFor(settings, id);
  const polling = POLLING[id];
  const name = widget?.name ?? id;
  const summary = [
    options.label ? `“${options.label}”` : null,
    LAYOUTS.find((l) => l.value === options.layout)?.label,
    options.accent === "theme" ? null : ACCENTS.find((a) => a.value === options.accent)?.label,
    polling ? `every ${formatSeconds(effectiveRefresh(id, options.refreshSeconds) ?? polling.defaultSeconds)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className={`option-row ${open ? "is-open" : ""}`} data-accent={options.accent}>
      <button type="button" className="option-row-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="option-swatch" aria-hidden />
        <span className="option-name">{name}</span>
        <span className="muted small option-summary">{summary}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open ? (
        <div className="option-body">
          <div className="option-field">
            <span className="small">Label</span>
            <LabelInput id={id} value={options.label} fallback={name} change={change} />
          </div>
          <div className="option-field">
            <span className="small">Layout</span>
            <Choice
              label={`${name} layout`}
              value={options.layout}
              options={LAYOUTS}
              onChange={(layout) => change((s) => setWidgetOptions(s, id, { layout }))}
            />
          </div>
          <div className="option-field">
            <span className="small">Accent</span>
            <div className="swatch-row" role="radiogroup" aria-label={`${name} accent`}>
              {ACCENTS.map((accent) => (
                <button
                  key={accent.value}
                  type="button"
                  role="radio"
                  aria-checked={options.accent === accent.value}
                  aria-label={accent.label}
                  title={accent.label}
                  data-accent={accent.value}
                  className={`swatch ${options.accent === accent.value ? "is-active" : ""}`}
                  onClick={() => change((s) => setWidgetOptions(s, id, { accent: accent.value }))}
                />
              ))}
            </div>
          </div>
          {polling ? (
            <label className="option-field">
              <span className="small">Check every</span>
              <select
                className="select"
                value={options.refreshSeconds ?? ""}
                onChange={(e) =>
                  change((s) =>
                    setWidgetOptions(s, id, { refreshSeconds: e.target.value === "" ? null : Number(e.target.value) }),
                  )
                }
              >
                <option value="">Default ({formatSeconds(polling.defaultSeconds)})</option>
                {refreshChoices(id).map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {formatSeconds(seconds)}
                  </option>
                ))}
              </select>
              {polling.why ? <span className="muted small">{polling.why}</span> : null}
            </label>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function WidgetOptionsSection({ settings, change }: { settings: AppSettings; change: Change }) {
  const ids = settings.dock.itemOrder.filter((id) => id !== ADD_WIDGET_ID && findWidget(id));
  return (
    <section className="settings-card">
      <h2>Widget options</h2>
      <p className="muted small">Each widget on the dock can have its own label, layout, accent and refresh.</p>
      <ul className="option-list">
        {ids.map((id) => (
          <WidgetOptionsRow key={id} id={id} settings={settings} change={change} />
        ))}
      </ul>
    </section>
  );
}

export function CustomisePage() {
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const change: Change = (fn) => void update(fn).then(setError);
  return (
    <div className="page settings-page">
      <PageHeader title="Customise" subtitle="Skins and options for each widget. Changes apply straight away." />
      {error ? (
        <p className="callout is-error" role="alert">
          {error}
        </p>
      ) : null}
      <SkinsSection settings={settings} change={change} />
      <WidgetOptionsSection settings={settings} change={change} />
    </div>
  );
}
