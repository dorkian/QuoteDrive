import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { INK, SERIES } from "./chart-theme";

export interface SparkData {
  values: number[];
  labels: string[];
  format: (value: number) => string;
}

/** A tiny trend line; hovering reads one week at a time into the tile. */
function Sparkline({
  data,
  onReadout,
}: {
  data: SparkData;
  onReadout: (text: string | null) => void;
}) {
  const W = 100;
  const H = 26;
  const { values } = data;
  const max = Math.max(...values, 1);
  const x = (i: number) =>
    values.length <= 1 ? W / 2 : (i / (values.length - 1)) * W;
  const y = (v: number) => H - 3 - (v / max) * (H - 6);
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const [at, setAt] = useState<number | null>(null);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-6 w-full"
      aria-hidden="true"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const i = Math.min(
          Math.max(
            Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)),
            0,
          ),
          values.length - 1,
        );
        setAt(i);
        onReadout(`Week of ${data.labels[i]}: ${data.format(values[i])}`);
      }}
      onPointerLeave={() => {
        setAt(null);
        onReadout(null);
      }}
    >
      <path
        d={d}
        fill="none"
        stroke={SERIES.blue}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      {at !== null && (
        <circle
          cx={x(at)}
          cy={y(values[at])}
          r={2.5}
          fill={SERIES.blue}
          stroke={INK.surface}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

/** One headline number. Links through to the page that owns the data. */
export function KpiTile({
  label,
  value,
  hint,
  href,
  spark,
  className,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  spark?: SparkData;
  className?: string;
  children?: ReactNode;
}) {
  const [readout, setReadout] = useState<string | null>(null);
  const body = (
    <>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
      <span
        className="min-h-4 truncate text-xs text-muted-foreground"
        aria-live="off"
      >
        {readout ?? hint}
      </span>
      {spark && <Sparkline data={spark} onReadout={setReadout} />}
      {children}
    </>
  );
  const base =
    "flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card p-3";
  return href ? (
    <Link
      to={href}
      aria-label={`${label}: ${value}${hint ? `, ${hint}` : ""}. Open details`}
      className={cn(
        base,
        "transition-colors duration-150 hover:border-navy-700 hover:bg-navy-800/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {body}
    </Link>
  ) : (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className={cn(base, className)}
    >
      {body}
    </div>
  );
}
