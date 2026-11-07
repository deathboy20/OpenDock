import { reorderDockItems, type DockPosition, type DockSettings, type DockSpacing } from "@opendock/config-schema";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  describeDockChange,
  edgeFromArrow,
  edgeIndex,
  edgeLabel,
  lookIsDefault,
  moveDockItem,
  nearestEdge,
  previewCaption,
  previewIsNumeric,
  reorderDelta,
  resetLook,
  sameDock,
  shellFloats,
  shellNotice,
  SPACING_DRAG_PX,
  spacingIndex,
  spacingLabel,
  stepSpacing,
  type ShellPlacement,
} from "../dock/appearance";
import { StylePicker } from "../dock/StylePicker";
import "../dock/dock.css";
import "../dock/style-picker.css";
import { ADD_WIDGET_ID, findWidget } from "../widgets/catalog";
import { Icon, type IconName } from "../widgets/icons";
import "./appearance-editor.css";
import { Choice, Toggle } from "./controls";

const ICONS: Record<string, IconName> = {
  start: "start",
  apps: "apps",
  media: "music",
  clock: "clock",
  volume: "volume",
  tray: "wifi",
  "add-widget": "plus",
  focus: "focus",
  todos: "todo",
  notes: "note",
  calendar: "calendar",
  system: "cpu",
  battery: "battery",
  weather: "clear",
  "day-progress": "progress",
};

const ICON_PX = { s: 12, m: 16, l: 20 } as const;

function widgetName(id: string): string {
  if (id === ADD_WIDGET_ID) return "Add widget";
  return findWidget(id)?.name ?? id;
}

function QuietButton({
  label,
  reason,
  disabled,
  onClick,
}: {
  label: string;
  reason: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="button"
      aria-disabled={disabled}
      aria-label={disabled ? `${label}, ${reason}` : label}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      {label}
    </button>
  );
}

export function AppearanceEditor({
  dock,
  shell,
  onCommit,
}: {
  dock: DockSettings;
  shell: ShellPlacement;
  onCommit: (next: DockSettings) => Promise<string | null>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef(dock);
  dockRef.current = dock;
  const past = useRef<{ dock: DockSettings; label: string }[]>([]);
  const cleanup = useRef<(() => void) | null>(null);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [draggingEdge, setDraggingEdge] = useState(false);
  const [edgeOverride, setEdgeOverride] = useState<DockPosition | null>(null);
  const [spacingOverride, setSpacingOverride] = useState<DockSpacing | null>(null);
  const spacingOverrideRef = useRef<DockSpacing | null>(null);
  const [itemLift, setItemLift] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (edgeOverride && dock.position === edgeOverride) setEdgeOverride(null);
  }, [dock.position, edgeOverride]);

  const shownEdge = edgeOverride ?? dock.position;
  const shownSpacing = spacingOverride ?? dock.spacing;
  const vertical = shownEdge === "left" || shownEdge === "right";

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const shell = shellRef.current;
    if (!stage || !shell) return;
    // zoom changes layout size in WebView2, so the dock stays centred. transform would not.
    shell.style.zoom = "1";
    const naturalW = shell.offsetWidth;
    const naturalH = shell.offsetHeight;
    if (naturalW < 1 || naturalH < 1) return;
    const availW = Math.max(1, stage.clientWidth - 16);
    const availH = Math.max(1, stage.clientHeight - 16);
    const scale = Math.min(1, availW / naturalW, availH / naturalH);
    shell.style.zoom = String(Math.round(scale * 1000) / 1000);
  }, [shownEdge, shownSpacing, dock.mode, dock.size, dock.style, dock.itemOrder, dock.clock24h, vertical]);
  const floating = shellFloats(shell);
  const notice = shellNotice(shell);
  const canUndo = revision >= 0 && past.current.length > 0;

  const commit = async (next: DockSettings, label?: string) => {
    const previous = dockRef.current;
    if (sameDock(previous, next)) return;
    const text = label ?? describeDockChange(previous, next);
    const error = await onCommit(next);
    if (error) {
      setFailed(true);
      setMessage(error);
      setEdgeOverride(null);
      return;
    }
    past.current.push({ dock: previous, label: text });
    setFailed(false);
    setMessage(text);
    setRevision((value) => value + 1);
  };

  const undo = async () => {
    const entry = past.current[past.current.length - 1];
    if (!entry) return;
    const error = await onCommit(entry.dock);
    if (error) {
      setFailed(true);
      setMessage(error);
      return;
    }
    past.current.pop();
    setFailed(false);
    setMessage(`Undid: ${entry.label}`);
    setPicked(null);
    setRevision((value) => value + 1);
  };

  const track = (onMove: (event: PointerEvent) => void, onUp: (event: PointerEvent) => void) => {
    cleanup.current?.();
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      cleanup.current = null;
    };
    const finish = (event: PointerEvent) => {
      stop();
      onUp(event);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    cleanup.current = stop;
  };

  const onStageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const edge = edgeFromArrow(event.key);
    if (!edge) return;
    event.preventDefault();
    void commit({ ...dockRef.current, position: edge });
  };

  const onDockPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".dock-item, .spacing-grip")) return;
    const stage = stageRef.current;
    if (!stage) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let nextEdge = dockRef.current.position;
    track(
      (ev) => {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        moved = true;
        const box = stage.getBoundingClientRect();
        nextEdge = nearestEdge(box.width, box.height, ev.clientX - box.left, ev.clientY - box.top, dockRef.current.position);
        setDraggingEdge(true);
        setEdgeOverride(nextEdge);
      },
      () => {
        setDraggingEdge(false);
        if (!moved || nextEdge === dockRef.current.position) {
          setEdgeOverride(null);
          return;
        }
        setEdgeOverride(nextEdge);
        void commit({ ...dockRef.current, position: nextEdge });
      },
    );
  };

  const onItemPointerDown = (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    track(
      (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        moved = true;
        setItemLift({ id, dx, dy });
      },
      (ev) => {
        setItemLift(null);
        if (!moved) return;
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const over = under?.closest<HTMLElement>("[data-preview-id]")?.dataset.previewId;
        if (!over || over === id) return;
        void commit({
          ...dockRef.current,
          itemOrder: reorderDockItems(dockRef.current.itemOrder, id, over),
        });
      },
    );
  };

  const onItemKeyDown = (id: string, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      event.stopPropagation();
      const next = picked === id ? null : id;
      setPicked(next);
      setFailed(false);
      setMessage(next ? `Picked up ${widgetName(id)}. Arrow keys move it.` : `Dropped ${widgetName(id)}.`);
      return;
    }
    if (event.key === "Escape" && picked === id) {
      event.preventDefault();
      setPicked(null);
      setMessage(`Left ${widgetName(id)} where it is.`);
      return;
    }
    const delta = picked === id ? reorderDelta(event.key) : null;
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    const itemOrder = moveDockItem(dockRef.current.itemOrder, id, delta);
    void commit({ ...dockRef.current, itemOrder });
  };

  const onGripKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : null;
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    void commit({ ...dockRef.current, spacing: stepSpacing(dockRef.current.spacing, delta) });
  };

  const onGripPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const start = vertical ? event.clientY : event.clientX;
    const origin = dockRef.current.spacing;
    const along = vertical;
    track(
      (ev) => {
        const delta = (along ? ev.clientY : ev.clientX) - start;
        const steps = Math.trunc(delta / SPACING_DRAG_PX);
        let next = origin;
        const dir = steps > 0 ? 1 : -1;
        for (let i = 0; i < Math.abs(steps); i += 1) next = stepSpacing(next, dir);
        spacingOverrideRef.current = next;
        setSpacingOverride(next);
      },
      () => {
        const next = spacingOverrideRef.current;
        spacingOverrideRef.current = null;
        setSpacingOverride(null);
        if (next && next !== origin) void commit({ ...dockRef.current, spacing: next });
      },
    );
  };

  return (
    <section className="appearance" aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" className="appearance-heading">
        Appearance
      </h2>
      <div className="appearance-toolbar">
        <p className={`appearance-status ${failed ? "is-error" : ""}`} role={failed ? "alert" : "status"} aria-live="polite">
          {message}
        </p>
        <div className="appearance-actions">
          <QuietButton label="Undo" reason="nothing to undo" disabled={!canUndo} onClick={() => void undo()} />
          <QuietButton
            label="Reset"
            reason="already the default look"
            disabled={lookIsDefault(dock)}
            onClick={() => void commit(resetLook(dockRef.current), "Reset the dock look.")}
          />
        </div>
      </div>

      <div ref={stageRef} className={`appearance-stage is-${shownEdge} ${draggingEdge ? "is-dragging" : ""}`}>
        <div
          className="appearance-mover"
          role="slider"
          tabIndex={0}
          aria-label={`Where the dock sits, ${edgeLabel(shownEdge)}`}
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={edgeIndex(shownEdge)}
          aria-valuetext={edgeLabel(shownEdge)}
          aria-describedby="appearance-keys"
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          onKeyDown={onStageKeyDown}
          onPointerDown={onDockPointerDown}
        />
        <div className={`appearance-edge is-${shownEdge} ${draggingEdge ? "is-target" : ""}`} aria-hidden />
        {notice ? <p className="appearance-notice">{notice}</p> : null}
        <div
          className={`stage-dock is-${shownEdge} is-${dock.mode} ${floating ? "is-floating" : ""} ${draggingEdge ? "is-lifted" : ""}`}
          onPointerDown={onDockPointerDown}
        >
          <div
            ref={shellRef}
            className={`dock-shell has-grip size-${dock.size} spacing-${shownSpacing} mode-${dock.mode} style-${dock.style} position-${shownEdge} ${vertical ? "vertical" : "horizontal"}`}
          >
            <div className="dock-track">
              {dock.itemOrder.map((id) => {
                const name = widgetName(id);
                const caption = vertical ? null : (previewCaption(id, dock.clock24h, now) ?? (id === "start" || id === ADD_WIDGET_ID ? null : name));
                const lifted = itemLift?.id === id ? itemLift : null;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`dock-item ${picked === id ? "is-picked" : ""} ${lifted ? "is-dragging" : ""}`}
                    data-preview-id={id}
                    aria-label={name}
                    aria-pressed={picked === id}
                    aria-keyshortcuts="Space"
                    style={lifted ? { transform: `translate(${lifted.dx}px, ${lifted.dy}px)` } : undefined}
                    onPointerDown={(event) => onItemPointerDown(id, event)}
                    onKeyDown={(event) => onItemKeyDown(id, event)}
                  >
                    <span className="tile is-ready">
                      <span className="tile-icon">
                        <Icon name={ICONS[id] ?? "grid"} size={ICON_PX[dock.size]} />
                      </span>
                      {caption ? (
                        <span className="tile-text">
                          <span className={`tile-primary ${previewIsNumeric(id) ? "tabular" : ""}`}>{caption}</span>
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            <div
              className={`spacing-grip ${spacingOverride ? "is-active" : ""}`}
              role="slider"
              tabIndex={0}
              aria-label="Spacing"
              aria-valuemin={0}
              aria-valuemax={2}
              aria-valuenow={spacingIndex(shownSpacing)}
              aria-valuetext={spacingLabel(shownSpacing)}
              aria-orientation={vertical ? "vertical" : "horizontal"}
              onKeyDown={onGripKeyDown}
              onPointerDown={onGripPointerDown}
            />
          </div>
        </div>
      </div>
      <p id="appearance-keys" className="appearance-hint muted small">
        Drag the dock, or focus the desk and use the arrow keys. Space picks up a widget. The bar at the end of the dock sets spacing.
      </p>

      <div className="appearance-styles">
        <StylePicker value={dock.style} onChange={(style) => void commit({ ...dockRef.current, style })} />
      </div>
      <div className="appearance-tools">
        <div className="appearance-field">
          <span>Shape</span>
          <Choice
            label="Shape"
            value={dock.mode}
            options={[
              { value: "pill", label: "Pill" },
              { value: "full", label: "Full width" },
            ]}
            onChange={(mode) => void commit({ ...dockRef.current, mode })}
          />
        </div>
        <div className="appearance-field">
          <span>Icon size</span>
          <Choice
            label="Icon size"
            value={dock.size}
            options={[
              { value: "s", label: "Small" },
              { value: "m", label: "Medium" },
              { value: "l", label: "Large" },
            ]}
            onChange={(size) => void commit({ ...dockRef.current, size })}
          />
        </div>
        <div className="appearance-field">
          <span>Theme</span>
          <Choice
            label="Theme"
            value={dock.theme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(theme) => void commit({ ...dockRef.current, theme })}
          />
        </div>
        <div className="appearance-field appearance-clock">
          <span>24-hour clock</span>
          <Toggle label="24-hour clock" checked={dock.clock24h} onChange={(clock24h) => void commit({ ...dockRef.current, clock24h })} />
        </div>
      </div>
    </section>
  );
}
