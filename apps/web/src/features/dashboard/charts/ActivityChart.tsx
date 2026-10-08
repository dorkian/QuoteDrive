import {
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { cn } from "@/lib/utils";
import type { WeeklyPoint } from "../../../lib/api";
import { ChartCard, DataTable } from "./ChartCard";
import { ChartTooltip, TipRow, type TipState } from "./ChartTooltip";
import { INK, SERIES, formatMoney, formatWeek, niceScale } from "./chart-theme";
import { useElementSize } from "./use-element-size";

const MARGIN = { top: 10, right: 12, bottom: 22, left: 28 };

const LINES = [
  {
    key: "opportunities_created",
    label: "Opportunities created",
    color: SERIES.blue,
  },
  { key: "versions_created", label: "Versions created", color: SERIES.orange },
] as const;
type LineKey = (typeof LINES)[number]["key"];

/** Weekly created counts: crosshair tooltip, legend toggles, arrow-key reading. */
export function ActivityChart({ weekly }: { weekly: WeeklyPoint[] }) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<LineKey>>(new Set());
  const [index, setIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const visible = LINES.filter((l) => !hidden.has(l.key));
  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const plotH = Math.max(height - MARGIN.top - MARGIN.bottom, 0);
  const n = weekly.length;

  const { max, ticks } = useMemo(
    () =>
      niceScale(
        Math.max(0, ...weekly.flatMap((w) => visible.map((l) => w[l.key]))),
        3,
      ),
    [weekly, visible],
  );

  const x = (i: number) =>
    MARGIN.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => MARGIN.top + plotH - (v / max) * plotH;
  const path = (key: LineKey) =>
    weekly
      .map(
        (w, i) =>
          `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(w[key]).toFixed(1)}`,
      )
      .join(" ");
  const area = (key: LineKey) =>
    n === 0
      ? ""
      : `${path(key)} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const labelEvery = Math.max(
    Math.ceil(n / Math.max(Math.floor(plotW / 58), 1)),
    1,
  );

  function show(i: number, px: number, py: number): void {
    const w = weekly[i];
    setIndex(i);
    setTip({
      x: px,
      y: py,
      content: (
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            Week of {formatWeek(w.week_start)}
          </p>
          {visible.map((l) => (
            <TipRow
              key={l.key}
              label={l.label}
              value={String(w[l.key])}
              color={l.color}
            />
          ))}
          <TipRow
            label="Value drafted"
            value={formatMoney(Number(w.value_created))}
          />
          <TipRow
            label="Approvals decided"
            value={String(w.approvals_decided)}
          />
        </div>
      ),
    });
  }

  function onMove(e: PointerEvent<SVGSVGElement>): void {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.min(
      Math.max(Math.round(((px - MARGIN.left) / (plotW || 1)) * (n - 1)), 0),
      n - 1,
    );
    show(i, x(i), e.clientY - rect.top);
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (n === 0) return;
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Escape") {
      setIndex(null);
      setTip(null);
    }
    if (!step) return;
    e.preventDefault();
    const next = Math.min(
      Math.max((index ?? (step > 0 ? -1 : n)) + step, 0),
      n - 1,
    );
    show(next, x(next), MARGIN.top + 8);
  }

  function toggle(key: LineKey): void {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (visible.length > 1) next.add(key); // keep at least one series on screen
      return next;
    });
  }

  const total = (key: LineKey) => weekly.reduce((sum, w) => sum + w[key], 0);

  return (
    <ChartCard
      className="h-72 lg:col-span-8 lg:h-auto"
      title="Weekly activity"
      subtitle={`${total("opportunities_created")} opportunities and ${total("versions_created")} versions in ${n} weeks`}
      table={
        <DataTable
          caption="Weekly activity"
          head={[
            "Week of",
            "Opportunities",
            "Versions",
            "Value drafted",
            "Approvals decided",
          ]}
          rows={weekly.map((w) => [
            formatWeek(w.week_start),
            w.opportunities_created,
            w.versions_created,
            formatMoney(Number(w.value_created)),
            w.approvals_decided,
          ])}
        />
      }
    >
      <div className="flex h-full flex-col">
        <div
          className="mb-1 flex flex-wrap gap-x-4 gap-y-1"
          role="group"
          aria-label="Series"
        >
          {LINES.map((l) => {
            const on = !hidden.has(l.key);
            return (
              <button
                key={l.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(l.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm text-xs transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on
                    ? "text-foreground"
                    : "text-muted-foreground line-through opacity-60",
                )}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-3 rounded-full"
                  style={{ background: l.color }}
                />
                {l.label}
              </button>
            );
          })}
        </div>
        <div
          ref={ref}
          className="relative min-h-0 flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          tabIndex={0}
          role="group"
          aria-label="Weekly activity chart. Use the left and right arrow keys to read each week."
          onKeyDown={onKey}
          onBlur={() => {
            setIndex(null);
            setTip(null);
          }}
        >
          {width > 0 && height > 0 && (
            <svg
              width={width}
              height={height}
              onPointerMove={onMove}
              onPointerLeave={() => {
                setIndex(null);
                setTip(null);
              }}
              aria-hidden="true"
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={y(t)}
                    y2={y(t)}
                    stroke={INK.grid}
                    strokeWidth={1}
                  />
                  <text
                    x={MARGIN.left - 6}
                    y={y(t)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={10}
                    fill={INK.muted}
                  >
                    {t}
                  </text>
                </g>
              ))}
              {weekly.map((w, i) =>
                i % labelEvery === 0 ? (
                  <text
                    key={w.week_start}
                    x={x(i)}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize={10}
                    fill={INK.muted}
                  >
                    {formatWeek(w.week_start)}
                  </text>
                ) : null,
              )}
              {visible.map((l) => (
                <g key={l.key}>
                  <path d={area(l.key)} fill={l.color} opacity={0.12} />
                  <path
                    d={path(l.key)}
                    fill="none"
                    stroke={l.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              ))}
              {index !== null && (
                <g>
                  <line
                    x1={x(index)}
                    x2={x(index)}
                    y1={MARGIN.top}
                    y2={MARGIN.top + plotH}
                    stroke={INK.secondary}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  {visible.map((l) => (
                    <circle
                      key={l.key}
                      cx={x(index)}
                      cy={y(weekly[index][l.key])}
                      r={4}
                      fill={l.color}
                      stroke={INK.surface}
                      strokeWidth={2}
                    />
                  ))}
                </g>
              )}
            </svg>
          )}
          <ChartTooltip tip={tip} width={width} />
        </div>
      </div>
    </ChartCard>
  );
}
