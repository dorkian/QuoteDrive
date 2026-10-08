import { useState } from "react";

import { cn } from "@/lib/utils";
import { formatStatus } from "@/lib/format";
import type { StageStat } from "../../../lib/api";
import { ChartCard, DataTable } from "./ChartCard";
import { INK, SERIES, STATUS } from "./chart-theme";
import { useElementSize } from "./use-element-size";

// Outcomes are statuses: fixed status colours, always with an icon and a label.
const OUTCOMES = [
  { status: "won", color: STATUS.good, icon: "✓" },
  { status: "lost", color: STATUS.critical, icon: "✕" },
  { status: "expired", color: STATUS.warning, icon: "◷" },
  { status: "shared", color: SERIES.blue, icon: "↗" },
] as const;

const GAP = 3;

/** Where proposals end up. Hover or select a slice to read it in the centre. */
export function OutcomeDonut({
  stages,
  winRate,
}: {
  stages: StageStat[];
  winRate: number | null;
}) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const counts = OUTCOMES.map((o) => ({
    ...o,
    count: stages.find((s) => s.status === o.status)?.count ?? 0,
  }));
  const total = counts.reduce((sum, o) => sum + o.count, 0);
  const active = hover ?? pinned;
  const focus = counts.find((o) => o.status === active) ?? null;

  const stacked = width < 360;
  const size = Math.max(
    Math.min(stacked ? width : width * 0.5, height - (stacked ? 70 : 0), 220),
    0,
  );
  const stroke = Math.max(size * 0.15, 10);
  const r = size / 2 - stroke / 2 - 2;
  const C = 2 * Math.PI * r;
  let acc = 0;

  const share = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <ChartCard
      title="Proposal outcomes"
      subtitle={
        total
          ? `${total} versions that reached the customer`
          : "No outcomes recorded yet"
      }
      table={
        <DataTable
          caption="Proposal outcomes"
          head={["Outcome", "Versions", "Share"]}
          rows={counts.map((o) => [
            formatStatus(o.status),
            o.count,
            `${share(o.count)}%`,
          ])}
        />
      }
      footer={
        winRate === null
          ? "Win rate needs at least one won or lost deal."
          : undefined
      }
    >
      <div
        ref={ref}
        className={cn(
          "flex h-full items-center justify-center gap-4",
          stacked && "flex-col gap-2",
        )}
      >
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Shared proposals and their outcomes will appear here.
          </p>
        ) : (
          <>
            {size > 0 && (
              <div
                className="relative shrink-0"
                style={{ width: size, height: size }}
              >
                <svg
                  width={size}
                  height={size}
                  role="img"
                  aria-label="Outcome shares"
                  className="-rotate-90"
                >
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={INK.grid}
                    strokeWidth={stroke}
                    opacity={0.4}
                  />
                  {counts.map((o) => {
                    if (o.count === 0) return null;
                    const len = (o.count / total) * C;
                    const dash = Math.max(
                      len -
                        (counts.filter((c) => c.count).length > 1 ? GAP : 0),
                      1,
                    );
                    const offset = -acc;
                    acc += len;
                    const dim = active !== null && active !== o.status;
                    return (
                      <circle
                        key={o.status}
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        stroke={o.color}
                        strokeWidth={active === o.status ? stroke + 4 : stroke}
                        strokeDasharray={`${dash} ${C}`}
                        strokeDashoffset={offset}
                        opacity={dim ? 0.35 : 1}
                        className="cursor-pointer transition-[opacity,stroke-width] duration-150 motion-reduce:transition-none"
                        onPointerEnter={() => setHover(o.status)}
                        onPointerLeave={() => setHover(null)}
                        onClick={() =>
                          setPinned((p) => (p === o.status ? null : o.status))
                        }
                      />
                    );
                  })}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  {focus ? (
                    <>
                      <span className="text-2xl font-semibold tabular-nums text-foreground">
                        {focus.count}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {focus.icon} {formatStatus(focus.status)} ·{" "}
                        {share(focus.count)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-semibold tabular-nums text-foreground">
                        {winRate === null ? "n/a" : `${Math.round(winRate)}%`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        win rate
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            <ul
              className={cn(
                "min-w-0 space-y-1",
                stacked && "flex flex-wrap gap-x-3 space-y-0",
              )}
              aria-label="Outcomes"
            >
              {counts.map((o) => (
                <li key={o.status}>
                  <button
                    type="button"
                    aria-pressed={pinned === o.status}
                    onPointerEnter={() => setHover(o.status)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(o.status)}
                    onBlur={() => setHover(null)}
                    onClick={() =>
                      setPinned((p) => (p === o.status ? null : o.status))
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-sm px-1 py-0.5 text-xs transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                      active !== null && active !== o.status && "opacity-50",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: o.color }}
                    />
                    <span
                      aria-hidden="true"
                      className="w-3 text-center text-muted-foreground"
                    >
                      {o.icon}
                    </span>
                    <span className="text-muted-foreground">
                      {formatStatus(o.status)}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {o.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </ChartCard>
  );
}
