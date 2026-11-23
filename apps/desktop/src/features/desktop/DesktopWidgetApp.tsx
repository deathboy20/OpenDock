import { widgetOptionsFor } from "@opendock/config-schema";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { settleDesktopWidget } from "../../services/ipc";
import { useSettings } from "../../services/settingsContext";
import { findWidget } from "../widgets/catalog";
import { TileContent } from "../widgets/tiles";
import { desktopWidgetId, movedFarEnough } from "./drag";
import "../dock/dock.css";
import "./desktop.css";

/** One widget on the desktop. Drag it anywhere; Rust snaps it to the grid and saves it. */
export function DesktopWidgetApp() {
  const { settings } = useSettings();
  const id = desktopWidgetId(isTauri() ? getCurrentWindow().label : "");
  const press = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;
    let timer: number | undefined;
    let off: (() => void) | undefined;
    void getCurrentWindow()
      .onMoved(() => {
        if (!dragging.current) return;
        window.clearTimeout(timer);
        // Windows sends a move for every step of a drag; save once it settles.
        timer = window.setTimeout(() => {
          dragging.current = false;
          void settleDesktopWidget().catch(() => undefined);
        }, 300);
      })
      .then((fn) => (off = fn));
    return () => {
      window.clearTimeout(timer);
      off?.();
    };
  }, []);

  if (!id) return null;
  const widget = findWidget(id);
  const options = widgetOptionsFor(settings, id);
  const name = options.label || widget?.name || id;
  return (
    <div
      className="desktop-widget dock-shell size-l"
      data-accent={options.accent}
      role="group"
      aria-label={`${name}. Drag to move it.`}
      title={`${name}. Drag to move; it snaps to the grid.`}
      onPointerDown={(e) => {
        if (e.button === 0) press.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const start = press.current;
        if (!start || (e.buttons & 1) === 0) return;
        if (movedFarEnough(start, { x: e.clientX, y: e.clientY })) {
          press.current = null;
          dragging.current = true;
          void getCurrentWindow().startDragging();
        }
      }}
      onPointerUp={() => (press.current = null)}
    >
      <div className="dock-item" data-widget={id} data-accent={options.accent}>
        <TileContent id={id} size="l" compact={options.layout === "compact"} />
      </div>
    </div>
  );
}
