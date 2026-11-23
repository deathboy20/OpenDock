import { DOCK_ONLY_WIDGETS, MAX_DESKTOP_WIDGETS, toggleDesktopWidget, type AppSettings } from "@opendock/config-schema";
import { Choice, Toggle } from "../hub/controls";
import { widgetCatalog } from "../widgets/catalog";

type Change = (fn: (s: AppSettings) => AppSettings) => void;

export function DesktopSection({ settings, change }: { settings: AppSettings; change: Change }) {
  const desktop = settings.desktop;
  const placeable = widgetCatalog.filter((w) => !DOCK_ONLY_WIDGETS.includes(w.id));
  const full = desktop.widgets.length >= MAX_DESKTOP_WIDGETS;
  return (
    <section className="settings-card">
      <h2>Desktop widgets</h2>
      <p className="muted small">
        Put widgets on the desktop, behind your windows. Drag one to move it; it snaps to the grid, and OpenDock remembers
        where it sits on each monitor. Its panel still opens from the dock.
      </p>
      <div className="setting-row">
        <div className="setting-label">
          <p>Grid</p>
          <p className="muted small">How far apart the snap points are.</p>
        </div>
        <div className="setting-control">
          <Choice
            label="Grid"
            value={String(desktop.grid) as "8" | "16" | "32"}
            options={[
              { value: "8", label: "Fine" },
              { value: "16", label: "Even" },
              { value: "32", label: "Wide" },
            ]}
            onChange={(grid) => change((s) => ({ ...s, desktop: { ...s.desktop, grid: Number(grid) } }))}
          />
        </div>
      </div>
      <ul className="desktop-list" aria-label="Widgets on the desktop">
        {placeable.map((widget) => {
          const on = desktop.widgets.some((w) => w.id === widget.id);
          return (
            <li key={widget.id}>
              <span className="grow">{widget.name}</span>
              <span className="muted small">{on ? "On the desktop" : ""}</span>
              <Toggle
                label={`${widget.name} on the desktop`}
                checked={on}
                onChange={() => {
                  if (!on && full) return;
                  change((s) => ({ ...s, desktop: toggleDesktopWidget(s.desktop, widget.id) }));
                }}
              />
            </li>
          );
        })}
      </ul>
      {full ? <p className="muted small">You can place up to {MAX_DESKTOP_WIDGETS} widgets.</p> : null}
    </section>
  );
}
