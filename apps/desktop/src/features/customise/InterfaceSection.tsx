import { widgetOptionsFor, type AppSettings, type DockDensity, type DockLayout, type DockTint } from "@opendock/config-schema";
import { useRef, useState } from "react";
import { islandEdges, islandStyle, useIslandRects } from "../dock/islands";
import { Choice, Row } from "../hub/controls";
import { ADD_WIDGET_ID } from "../widgets/catalog";
import { TileContent } from "../widgets/tiles";
import "../dock/dock.css";

type Change = (fn: (s: AppSettings) => AppSettings) => void;
type Backdrop = "dark" | "bright" | "busy";

const LAYOUTS: { value: DockLayout; label: string }[] = [
  { value: "bar", label: "One bar" },
  { value: "islands", label: "Islands" },
  { value: "chips", label: "Chips" },
];
const DENSITIES: { value: DockDensity; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "slim", label: "Slim" },
];
const TINTS: { value: DockTint; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "medium", label: "Medium" },
  { value: "strong", label: "Strong" },
];
const BACKDROPS: { value: Backdrop; label: string }[] = [
  { value: "dark", label: "Dark wallpaper" },
  { value: "bright", label: "Bright" },
  { value: "busy", label: "Busy" },
];

/** The dock as it will look, with its real widgets, over a sample wallpaper. */
function InterfacePreview({ settings, backdrop }: { settings: AppSettings; backdrop: Backdrop }) {
  const dock = settings.dock;
  const ids = dock.itemOrder.filter((id) => id !== ADD_WIDGET_ID).slice(0, 8);
  const islands = islandEdges(ids, dock.layout);
  const trackRef = useRef<HTMLDivElement>(null);
  const rects = useIslandRects(
    trackRef,
    false,
    islands !== null,
    `${ids.join(",")}|${dock.layout}|${dock.size}|${dock.density}|${dock.spacing}`,
  );
  return (
    <div className={`interface-preview backdrop-${backdrop}`} aria-hidden>
      <div
        className={`preview-dock dock-shell size-${dock.size} spacing-${dock.spacing} style-${dock.style} layout-${dock.layout} density-${dock.density} tint-${dock.tint} horizontal`}
      >
        {rects.length > 0 ? (
          <div className="dock-islands">
            {rects.map((rect, i) => (
              <span key={i} className="dock-island" style={islandStyle(rect)} />
            ))}
          </div>
        ) : null}
        <div className="dock-track" ref={trackRef}>
          {ids.map((id) => {
            const options = widgetOptionsFor(settings, id);
            return (
              <div className="dock-item" key={id} data-island={islands?.[id]} data-accent={options.accent}>
                <TileContent
                  id={id}
                  size={options.layout === "detailed" ? "l" : dock.size}
                  compact={options.layout === "compact"}
                  variant={options.variant ?? undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function InterfaceSection({ settings, change }: { settings: AppSettings; change: Change }) {
  const [backdrop, setBackdrop] = useState<Backdrop>("bright");
  const dock = settings.dock;
  const setDock = (patch: Partial<AppSettings["dock"]>) => change((s) => ({ ...s, dock: { ...s.dock, ...patch } }));
  return (
    <section className="settings-card">
      <h2>Interface</h2>
      <p className="muted small">
        The shape of the dock. Islands split it into capsules of related widgets, and chips give every widget its own.
        A stronger tint keeps it readable on bright or busy wallpapers.
      </p>
      <InterfacePreview settings={settings} backdrop={backdrop} />
      <div className="interface-backdrops">
        <Choice label="Preview wallpaper" value={backdrop} options={BACKDROPS} onChange={setBackdrop} />
      </div>
      <Row label="Layout">
        <Choice label="Layout" value={dock.layout} options={LAYOUTS} onChange={(layout) => setDock({ layout })} />
      </Row>
      <Row label="Thickness" hint="Slim makes the dock thinner and moves windows less.">
        <Choice label="Thickness" value={dock.density} options={DENSITIES} onChange={(density) => setDock({ density })} />
      </Row>
      <Row label="Tint" hint="How see-through the dock is. Glass and Midnight show it best.">
        <Choice label="Tint" value={dock.tint} options={TINTS} onChange={(tint) => setDock({ tint })} />
      </Row>
    </section>
  );
}
