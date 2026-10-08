import { useState } from "react";

import type { AiStat } from "../../../lib/api";
import { KpiTile } from "./KpiTile";
import { ChartTooltip, TipRow, type TipState } from "./ChartTooltip";
import { STATUS, formatLatency } from "./chart-theme";

/** AI draft health: share of generations that produced a draft, split by outcome. */
export function AiHealthTile({
  ai,
  successRate,
  generations,
}: {
  ai: AiStat[];
  successRate: number | null;
  generations: number;
}) {
  const [tip, setTip] = useState<TipState | null>(null);
  const [width, setWidth] = useState(0);

  const succeeded = ai.reduce((sum, a) => sum + a.succeeded, 0);
  const failed = ai.reduce((sum, a) => sum + a.failed, 0);
  const viaFallback = Math.min(
    ai.reduce((sum, a) => sum + a.fallbacks, 0),
    succeeded,
  );
  const direct = succeeded - viaFallback;
  const latencies = ai
    .map((a) => a.median_latency_ms)
    .filter((l): l is number => l !== null);
  const slowest = latencies.length ? Math.max(...latencies) : null;

  const segments = [
    { label: "Drafted directly", n: direct, color: STATUS.good, icon: "✓" },
    {
      label: "Drafted via fallback",
      n: viaFallback,
      color: STATUS.warning,
      icon: "↻",
    },
    { label: "Failed", n: failed, color: STATUS.critical, icon: "✕" },
  ];

  return (
    <KpiTile
      label="AI drafts"
      value={successRate === null ? "n/a" : `${Math.round(successRate)}%`}
      hint={
        generations
          ? `${generations} generations${slowest ? ` · up to ${formatLatency(slowest)}` : ""}`
          : "No generations in this range"
      }
    >
      {generations > 0 && (
        <div
          className="relative mt-1"
          ref={(el) => {
            if (el && el.clientWidth !== width) setWidth(el.clientWidth);
          }}
          onPointerLeave={() => setTip(null)}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTip({
              x: e.clientX - r.left,
              y: -6,
              content: (
                <div className="space-y-1">
                  {segments.map((s) => (
                    <TipRow
                      key={s.label}
                      label={s.label}
                      value={String(s.n)}
                      icon={s.icon}
                      color={s.color}
                    />
                  ))}
                  <div className="my-1 border-t border-border" />
                  {ai.map((a) => (
                    <TipRow
                      key={`${a.provider}-${a.model}`}
                      label={a.provider}
                      value={`${a.succeeded}/${a.total}${a.median_latency_ms ? ` · ${formatLatency(a.median_latency_ms)}` : ""}`}
                    />
                  ))}
                </div>
              ),
            });
          }}
        >
          <div
            className="flex h-2 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={segments.map((s) => `${s.label} ${s.n}`).join(", ")}
          >
            {segments.map((s) =>
              s.n > 0 ? (
                <span
                  key={s.label}
                  style={{ flex: s.n, background: s.color }}
                />
              ) : null,
            )}
          </div>
          <ChartTooltip tip={tip} width={width} />
        </div>
      )}
    </KpiTile>
  );
}
