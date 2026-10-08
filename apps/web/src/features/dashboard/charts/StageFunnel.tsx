import { useState } from "react";

import { cn } from "@/lib/utils";
import { formatStatus } from "@/lib/format";
import type { StageStat } from "../../../lib/api";
import { ChartCard, DataTable } from "./ChartCard";
import { ChartTooltip, TipRow, type TipState } from "./ChartTooltip";
import { INK, SERIES, formatCompactMoney, formatMoney } from "./chart-theme";
import { useElementSize } from "./use-element-size";

const MAIN_PATH = [
  "draft",
  "configured",
  "proposal_drafted",
  "awaiting_approval",
  "approved",
  "shared",
  "won",
] as const;
const OFF_PATH = ["changes_requested", "lost", "expired"] as const;

const ROW = 22;
const LABEL_W = 112;
const VALUE_W = 74;

/** Versions per stage with their monthly value. Click a stage to pin its detail. */
export function StageFunnel({ stages }: { stages: StageStat[] }) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [selected, setSelected] = useState<string | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const byStatus = new Map(stages.map((s) => [s.status, s]));
  const stat = (status: string) =>
    byStatus.get(status) ?? { status, count: 0, value: "0" };
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const max = Math.max(1, ...MAIN_PATH.map((s) => stat(s).count));
  const barW = Math.max(width - LABEL_W - VALUE_W, 0);

  function detail(status: string) {
    const s = stat(status);
    return { s, share: total ? Math.round((s.count / total) * 100) : 0 };
  }

  function showTip(status: string, px: number, py: number): void {
    const { s, share } = detail(status);
    setTip({
      x: px,
      y: py,
      content: (
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            {formatStatus(status)}
          </p>
          <TipRow label="Versions" value={String(s.count)} />
          <TipRow label="Monthly value" value={formatMoney(Number(s.value))} />
          <TipRow label="Share of all versions" value={`${share}%`} />
        </div>
      ),
    });
  }

  const pick = (status: string) =>
    setSelected((cur) => (cur === status ? null : status));
  const sel = selected ? detail(selected) : null;

  return (
    <ChartCard
      className="h-72 lg:col-span-4 lg:h-auto"
      title="Proposal pipeline"
      subtitle={`${total} versions by stage`}
      table={
        <DataTable
          caption="Proposal versions by stage"
          head={["Stage", "Versions", "Monthly value"]}
          rows={[...MAIN_PATH, ...OFF_PATH].map((s) => [
            formatStatus(s),
            stat(s).count,
            formatMoney(Number(stat(s).value)),
          ])}
        />
      }
      footer={
        sel ? (
          <p aria-live="polite">
            <span className="font-medium text-foreground">
              {formatStatus(sel.s.status)}
            </span>
            {": "}
            {sel.s.count} versions, {formatMoney(Number(sel.s.value))}/mo,{" "}
            {sel.share}% of all
          </p>
        ) : (
          <p>Select a stage for its detail.</p>
        )
      }
    >
      <div
        ref={ref}
        className="relative flex h-full flex-col justify-between"
        onPointerLeave={() => setTip(null)}
      >
        <ul aria-label="Main path">
          {MAIN_PATH.map((status) => {
            const s = stat(status);
            const w = (s.count / max) * barW;
            const on = selected === status;
            return (
              <li key={status}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${formatStatus(status)}: ${s.count} versions, ${formatMoney(Number(s.value))} per month`}
                  onClick={() => pick(status)}
                  onPointerMove={(e) => {
                    const r = ref.current?.getBoundingClientRect();
                    if (r)
                      showTip(status, e.clientX - r.left, e.clientY - r.top);
                  }}
                  onFocus={(e) => {
                    // Keyboard focus only; a click focuses too and would pin the tip.
                    if (e.currentTarget.matches(":focus-visible"))
                      showTip(status, LABEL_W + 8, 0);
                  }}
                  onBlur={() => setTip(null)}
                  className="group flex w-full items-center rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  style={{ height: ROW }}
                >
                  <span
                    className={cn(
                      "shrink-0 truncate pr-2 text-xs",
                      on
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                    style={{ width: LABEL_W }}
                  >
                    {formatStatus(status)}
                  </span>
                  <svg
                    width={barW}
                    height={ROW - 8}
                    aria-hidden="true"
                    className="shrink-0"
                  >
                    <rect
                      x={0}
                      y={0}
                      width={barW}
                      height={ROW - 8}
                      rx={4}
                      fill={INK.grid}
                      opacity={0.5}
                    />
                    {s.count > 0 && (
                      <rect
                        x={0}
                        y={0}
                        width={Math.max(w, 4)}
                        height={ROW - 8}
                        rx={4}
                        fill={SERIES.blue}
                        stroke={on ? INK.focus : "none"}
                        strokeWidth={2}
                        className="transition-[width,opacity] duration-200 group-hover:opacity-80 motion-reduce:transition-none"
                      />
                    )}
                  </svg>
                  <span
                    className="shrink-0 pl-2 text-right text-xs tabular-nums"
                    style={{ width: VALUE_W }}
                  >
                    <span className="font-semibold text-foreground">
                      {s.count}
                    </span>
                    <span className="ml-1 text-muted-foreground">
                      {formatCompactMoney(Number(s.value))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul
          className="mt-1.5 flex flex-wrap gap-1.5"
          aria-label="Off the main path"
        >
          {OFF_PATH.map((status) => {
            const s = stat(status);
            const on = selected === status;
            return (
              <li key={status}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => pick(status)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs tabular-nums transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    on
                      ? "border-primary text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {formatStatus(status)}{" "}
                  <span className="font-semibold text-foreground">
                    {s.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <ChartTooltip tip={tip} width={width} />
      </div>
    </ChartCard>
  );
}
