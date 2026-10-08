import type { ReactNode } from "react";

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

/**
 * Floating readout, positioned inside a `relative` chart wrapper. Flips to the
 * left of the pointer near the right edge so it never clips. Everything it
 * shows is also reachable through the card's table view.
 */
export function ChartTooltip({
  tip,
  width,
}: {
  tip: TipState | null;
  width: number;
}) {
  if (!tip) return null;
  const flip = tip.x > width * 0.6;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 min-w-32 max-w-60 rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-lg"
      style={{
        left: flip ? undefined : tip.x + 12,
        right: flip ? Math.max(width - tip.x + 12, 0) : undefined,
        top: Math.max(tip.y - 12, 0),
      }}
    >
      {tip.content}
    </div>
  );
}

export function TipRow({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {color && (
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-3 rounded-full"
            style={{ background: color }}
          />
        )}
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
