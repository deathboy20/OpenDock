import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderDockItems, widgetOptionsFor } from "@opendock/config-schema";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  applyDockLayout,
  on,
  openHub,
  openStartMenu,
  setDockLength,
  showFlyout,
} from "../../services/ipc";
import { useSettings } from "../../services/settingsContext";
import { ADD_WIDGET_ID, findWidget } from "../widgets/catalog";
import { TileContent } from "../widgets/tiles";
import { decideTileClick, flyoutKey, type FlyoutMemory } from "./dockClick";
import { anchorOf, DockActionsContext } from "./dockActions";
import { islandEdges, islandStyle, useIslandRects, type IslandEdge } from "./islands";
import "./dock.css";

const HIGHLIGHT_MS = 4000;

function DockItem({
  id,
  vertical,
  highlighted,
  island,
  onActivate,
  onMenu,
}: {
  id: string;
  vertical: boolean;
  highlighted: boolean;
  island?: IslandEdge;
  onActivate: (id: string, anchor: number) => void;
  onMenu: (id: string, anchor: number) => void;
}) {
  const { settings } = useSettings();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const options = widgetOptionsFor(settings, id);
  const name = id === ADD_WIDGET_ID ? "Add widget" : options.label || (findWidget(id)?.name ?? id);
  const compact = vertical || options.layout === "compact";
  const size = options.layout === "detailed" ? "l" : settings.dock.size;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`dock-item ${isDragging ? "is-dragging" : ""} ${highlighted ? "is-highlighted" : ""}`}
      data-widget={id}
      data-accent={options.accent}
      data-island={island}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={name}
      aria-roledescription="dock widget"
      onClick={(event) => onActivate(id, anchorOf(event.currentTarget, vertical))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onActivate(id, anchorOf(event.currentTarget, vertical));
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          onMenu(id, anchorOf(event.currentTarget, vertical));
        } else {
          listeners?.onKeyDown?.(event);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onMenu(id, anchorOf(event.currentTarget, vertical));
      }}
    >
      <TileContent id={id} size={size} compact={compact} variant={options.variant ?? undefined} />
    </div>
  );
}

export function DockBar() {
  const { settings, update } = useSettings();
  const { dock } = settings;
  const vertical = dock.position === "left" || dock.position === "right";
  const trackRef = useRef<HTMLDivElement>(null);
  const memory = useRef<FlyoutMemory>({ openKind: null, hiddenKind: null, hiddenAt: 0 });
  const [highlight, setHighlight] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  useEffect(() => {
    const offs = [
      on("flyout:hidden", ({ kind, at }) => {
        memory.current = { openKind: null, hiddenKind: kind, hiddenAt: at };
      }),
      on("dock:highlight", (id) => setHighlight(id)),
      on("dock:fullscreen-visible", () => void applyDockLayout()),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  // Pills hug their widgets: tell the backend how long the content is.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const shell = track.parentElement;
        const padding = shell
          ? vertical
            ? shell.offsetHeight - shell.clientHeight + 16
            : shell.offsetWidth - shell.clientWidth + 16
          : 16;
        // The apps strip shrinks and scrolls once the dock reaches the screen
        // edge, so its box is smaller than the icons it holds. Add that hidden
        // part back, or the dock would stop growing while space remains.
        const scroller = track.querySelector(".apps-scroller");
        const hidden = scroller
          ? Math.max(
              0,
              vertical
                ? scroller.scrollHeight - scroller.clientHeight
                : scroller.scrollWidth - scroller.clientWidth,
            )
          : 0;
        // Islands put a margin before each new island, so margins count too.
        const box = Array.from(track.children).reduce((sum, child) => {
          const el = child as HTMLElement;
          const style = getComputedStyle(el);
          const margin = vertical
            ? Number.parseFloat(style.marginTop) + Number.parseFloat(style.marginBottom)
            : Number.parseFloat(style.marginLeft) + Number.parseFloat(style.marginRight);
          return sum + (vertical ? el.offsetHeight : el.offsetWidth) + (Number.isFinite(margin) ? margin : 0);
        }, 0);
        const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
        const length = box + gap * Math.max(0, track.children.length - 1) + hidden + padding;
        void setDockLength(length).catch(() => undefined);
      });
    };
    const observer = new ResizeObserver(report);
    observer.observe(track);
    Array.from(track.children).forEach((child) => observer.observe(child));
    report();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [vertical, dock.itemOrder, dock.size, dock.layout, dock.density]);

  const open = (kind: string, anchor: number, target?: string) => {
    const key = flyoutKey(kind, target);
    const decision = decideTileClick(memory.current, key, Date.now());
    if (decision === "ignore") return;
    memory.current = { ...memory.current, openKind: key };
    void showFlyout({ kind, anchor, target: target ?? null });
  };

  const onActivate = (id: string, anchor: number) => {
    if (id === "start") {
      if (dock.startAction === "launcher") open("start", anchor);
      else void openStartMenu();
    } else if (id === ADD_WIDGET_ID) {
      void openHub("widgets");
    } else if (findWidget(id)?.panel) {
      open(id, anchor);
    }
  };

  const onMenu = (id: string | null, anchor: number) => {
    open("menu", anchor, id ?? undefined);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    void update((current) => ({
      ...current,
      dock: {
        ...current.dock,
        itemOrder: reorderDockItems(current.dock.itemOrder, String(active.id), String(over.id)),
      },
    }));
  };

  const islands = islandEdges(dock.itemOrder, dock.layout);
  const islandRects = useIslandRects(
    trackRef,
    vertical,
    islands !== null,
    `${dock.itemOrder.join(",")}|${dock.layout}|${dock.size}|${dock.density}|${dock.spacing}`,
  );

  const onShellPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".dock-item")) return;
    void getCurrentWindow()
      .startDragging()
      .catch(() => undefined);
  };

  return (
    <div
      className={`dock-shell size-${dock.size} spacing-${dock.spacing} mode-${dock.mode} style-${dock.style} layout-${dock.layout} density-${dock.density} tint-${dock.tint} position-${dock.position} ${vertical ? "vertical" : "horizontal"}`}
      role="toolbar"
      aria-label="OpenDock"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      onPointerDown={onShellPointerDown}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(null, vertical ? event.clientY : event.clientX);
      }}
    >
      {islandRects.length > 0 ? (
        <div className="dock-islands" aria-hidden>
          {islandRects.map((rect, i) => (
            <span key={i} className="dock-island" style={islandStyle(rect)} />
          ))}
        </div>
      ) : null}
      <DockActionsContext.Provider value={{ openPanel: open, vertical }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={dock.itemOrder}
            strategy={vertical ? verticalListSortingStrategy : horizontalListSortingStrategy}
          >
            <div className="dock-track" ref={trackRef}>
              {dock.itemOrder.map((id) => (
                <DockItem
                  key={id}
                  id={id}
                  vertical={vertical}
                  highlighted={highlight === id}
                  island={islands?.[id]}
                  onActivate={onActivate}
                  onMenu={onMenu}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </DockActionsContext.Provider>
    </div>
  );
}
