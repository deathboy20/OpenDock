import type { DockSize } from "@opendock/config-schema";
import type { ReactNode } from "react";
import { Skeleton } from "./visuals";

export type TileProps = {
  size: DockSize;
  compact: boolean;
  /** One of the widget's variants from widget-variants.json; TileContent resolves the default. */
  variant?: string;
};

export type TileState = "ready" | "loading" | "empty" | "error";

export function Tile({
  state,
  icon,
  primary,
  secondary,
  extra,
  title,
  compact,
}: {
  state: TileState;
  icon: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  extra?: ReactNode;
  title?: string;
  compact: boolean;
}) {
  return (
    <span className={`tile is-${state}`} title={title}>
      <span className="tile-icon">{icon}</span>
      {compact ? null : (
        <span className="tile-text">
          {state === "loading" ? (
            <Skeleton width={52} />
          ) : (
            <>
              {primary !== undefined ? <span className="tile-primary">{primary}</span> : null}
              {secondary !== undefined ? <span className="tile-secondary">{secondary}</span> : null}
            </>
          )}
        </span>
      )}
      {extra && !compact ? <span className="tile-extra">{extra}</span> : null}
    </span>
  );
}
