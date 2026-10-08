import { useState } from "react";

import { cn } from "@/lib/utils";
import type { PackageStat } from "../../../lib/api";
import { ChartCard, DataTable } from "./ChartCard";
import { ChartTooltip, TipRow, type TipState } from "./ChartTooltip";
import { INK, SERIES, formatCompactMoney, formatMoney } from "./chart-theme";
import { useElementSize } from "./use-element-size";

type SortKey = "value" | "quantity";
const ROW = 26;
const LABEL_W = 132;
const VALUE_W = 56;
const SHOWN = 6;

/** What gets proposed, by monthly value or by units. */
export function PackageMix({ packages }: { packages: PackageStat[] }) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [sort, setSort] = useState<SortKey>("value");
  const [tip, setTip] = useState<TipState | null>(null);

  const measure = (p: PackageStat) =>
    sort === "value" ? Number(p.value) : p.quantity;
  const sorted = [...packages].sort((a, b) => measure(b) - measure(a));
  const rows = sorted.slice(0, SHOWN);
  const max = Math.max(1, ...rows.map(measure));
  const totalValue = packages.reduce((sum, p) => sum + Number(p.value), 0);
  const totalUnits = packages.reduce((sum, p) => sum + p.quantity, 0);
  const barW = Math.max(width - LABEL_W - VALUE_W, 0);

  function show(p: PackageStat, px: number, py: number): void {
    setTip({
      x: px,
      y: py,
      content: (
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{p.name}</p>
          <TipRow label="Monthly value" value={formatMoney(Number(p.value))} />
          <TipRow label="Units" value={String(p.quantity)} />
          <TipRow
            label="Share of value"
            value={`${totalValue ? Math.round((Number(p.value) / totalValue) * 100) : 0}%`}
          />
        </div>
      ),
    });
  }

  return (
    <ChartCard
      title="Package mix"
      subtitle={
        packages.length
          ? `${totalUnits} units · ${formatCompactMoney(totalValue)}/mo proposed`
          : "Nothing proposed in this range"
      }
      table={
        <DataTable
          caption="Package mix"
          head={["Package", "Units", "Monthly value"]}
          rows={sorted.map((p) => [
            p.name,
            p.quantity,
            formatMoney(Number(p.value)),
          ])}
        />
      }
    >
      {packages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add packages to a proposal to see the mix.
        </p>
      ) : (
        <div
          ref={ref}
          className="relative flex h-full flex-col"
          onPointerLeave={() => setTip(null)}
        >
          <div
            className="mb-1 flex gap-1"
            role="group"
            aria-label="Sort packages by"
          >
            {(["value", "quantity"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  sort === key
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {key === "value" ? "By value" : "By units"}
              </button>
            ))}
          </div>
          <ul>
            {rows.map((p) => (
              <li key={p.name}>
                <div
                  tabIndex={0}
                  role="group"
                  aria-label={`${p.name}: ${p.quantity} units, ${formatMoney(Number(p.value))} per month`}
                  onPointerMove={(e) => {
                    const r = ref.current?.getBoundingClientRect();
                    if (r) show(p, e.clientX - r.left, e.clientY - r.top);
                  }}
                  onFocus={() => show(p, LABEL_W + 8, 24)}
                  onBlur={() => setTip(null)}
                  className="group flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  style={{ height: ROW }}
                >
                  <span
                    className="shrink-0 truncate pr-2 text-xs text-muted-foreground"
                    style={{ width: LABEL_W }}
                  >
                    {p.name}
                  </span>
                  <svg
                    width={barW}
                    height={ROW - 10}
                    aria-hidden="true"
                    className="shrink-0"
                  >
                    <rect
                      width={barW}
                      height={ROW - 10}
                      rx={4}
                      fill={INK.grid}
                      opacity={0.5}
                    />
                    <rect
                      width={Math.max((measure(p) / max) * barW, 4)}
                      height={ROW - 10}
                      rx={4}
                      fill={SERIES.blue}
                      className="transition-[width,opacity] duration-200 group-hover:opacity-80 motion-reduce:transition-none"
                    />
                  </svg>
                  <span
                    className="shrink-0 pl-2 text-right text-xs font-semibold tabular-nums text-foreground"
                    style={{ width: VALUE_W }}
                  >
                    {sort === "value"
                      ? formatCompactMoney(Number(p.value))
                      : p.quantity}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {sorted.length > SHOWN && (
            <p className="mt-1 text-xs text-muted-foreground">
              +{sorted.length - SHOWN} more in the table view
            </p>
          )}
          <ChartTooltip tip={tip} width={width} />
        </div>
      )}
    </ChartCard>
  );
}
