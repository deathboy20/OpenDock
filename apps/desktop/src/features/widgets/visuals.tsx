import type { ReactNode } from "react";
import { Icon } from "./icons";

export function Ring({
  value,
  size = 28,
  stroke = 3,
  tone = "accent",
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "accent" | "warn" | "info";
  children?: ReactNode;
  label?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={`od-ring tone-${tone}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="od-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="od-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? <span className="od-ring-label">{children}</span> : null}
    </span>
  );
}

export function Sparkline({
  values,
  width = 56,
  height = 20,
  max = 100,
}: {
  values: number[];
  width?: number;
  height?: number;
  max?: number;
}) {
  if (values.length < 2) {
    return <span className="od-sparkline is-empty" style={{ width, height }} aria-hidden />;
  }
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const y = height - (Math.min(max, Math.max(0, v)) / max) * (height - 2) - 1;
    return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `0,${height} ${points.join(" ")} ${width},${height}`;
  return (
    <svg className="od-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polygon className="od-sparkline-area" points={area} />
      <polyline className="od-sparkline-line" points={points.join(" ")} />
    </svg>
  );
}

export function Bar({ value, tone = "accent", label }: { value: number; tone?: "accent" | "warn"; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span
      className={`od-bar tone-${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <span className="od-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Shared empty, loading and error states for panels. */
export function PanelState({
  kind,
  title,
  detail,
  action,
}: {
  kind: "loading" | "empty" | "error";
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`panel-state is-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {kind === "loading" ? (
        <span className="od-spinner" aria-hidden />
      ) : (
        <Icon name={kind === "error" ? "warning" : "spark"} size={22} />
      )}
      <p className="panel-state-title">{title}</p>
      {detail ? <p className="panel-state-detail">{detail}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ width = 48 }: { width?: number }) {
  return <span className="od-skeleton" style={{ width }} aria-hidden />;
}

/** A row of cells, `filled` of them lit. Reads like a battery or a day of hours. */
export function Dots({
  count,
  filled,
  tone = "accent",
  label,
}: {
  count: number;
  filled: number;
  tone?: "accent" | "warn" | "info";
  label?: string;
}) {
  const lit = Math.min(count, Math.max(0, Math.round(filled)));
  return (
    <span className={`od-dots tone-${tone}`} role={label ? "img" : undefined} aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i < lit ? "is-lit" : undefined} aria-hidden />
      ))}
    </span>
  );
}

/** A half-circle gauge, empty on the left and full on the right. */
export function Gauge({
  value,
  size = 30,
  tone = "accent",
  label,
}: {
  value: number;
  size?: number;
  tone?: "accent" | "warn" | "info";
  label?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const stroke = 3;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2 + 2;
  const length = Math.PI * r;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const angle = Math.PI * (1 - clamped);
  const needle = { x: cx + (r - 5) * Math.cos(angle), y: cy - (r - 5) * Math.sin(angle) };
  return (
    <svg
      className={`od-gauge tone-${tone}`}
      width={size}
      height={size / 2 + 6}
      viewBox={`0 0 ${size} ${size / 2 + 6}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path className="od-gauge-track" d={arc} strokeWidth={stroke} />
      <path
        className="od-gauge-value"
        d={arc}
        strokeWidth={stroke}
        strokeDasharray={length}
        strokeDashoffset={length * (1 - clamped)}
      />
      <line className="od-gauge-needle" x1={cx} y1={cy} x2={needle.x.toFixed(2)} y2={needle.y.toFixed(2)} />
      <circle className="od-gauge-hub" cx={cx} cy={cy} r={1.8} />
    </svg>
  );
}

/** An analog clock face with hour and minute hands. */
export function AnalogClock({ date, size = 28, label }: { date: Date; size?: number; label?: string }) {
  const c = size / 2;
  const minutes = date.getMinutes() + date.getSeconds() / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  const hand = (turns: number, length: number) => {
    const a = turns * 2 * Math.PI - Math.PI / 2;
    return { x2: (c + length * Math.cos(a)).toFixed(2), y2: (c + length * Math.sin(a)).toFixed(2) };
  };
  return (
    <svg
      className="od-analog"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle className="od-analog-face" cx={c} cy={c} r={c - 1.5} />
      {[0, 3, 6, 9].map((h) => {
        const a = (h / 12) * 2 * Math.PI;
        return (
          <line
            key={h}
            className="od-analog-tick"
            x1={(c + (c - 4) * Math.sin(a)).toFixed(2)}
            y1={(c - (c - 4) * Math.cos(a)).toFixed(2)}
            x2={(c + (c - 2.5) * Math.sin(a)).toFixed(2)}
            y2={(c - (c - 2.5) * Math.cos(a)).toFixed(2)}
          />
        );
      })}
      <line className="od-analog-hour" x1={c} y1={c} {...hand(hours / 12, c * 0.48)} />
      <line className="od-analog-minute" x1={c} y1={c} {...hand(minutes / 60, c * 0.72)} />
      <circle className="od-analog-hub" cx={c} cy={c} r={1.4} />
    </svg>
  );
}
