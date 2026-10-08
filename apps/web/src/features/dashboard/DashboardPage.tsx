import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { ActivityTimeline } from "../../components/ActivityTimeline";
import {
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import {
  fetchDashboardAnalytics,
  type AnalyticsRange,
  type DashboardAnalytics,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";
import { ActivityChart } from "./charts/ActivityChart";
import { AiHealthTile } from "./charts/AiHealthTile";
import { KpiTile, type SparkData } from "./charts/KpiTile";
import { OutcomeDonut } from "./charts/OutcomeDonut";
import { PackageMix } from "./charts/PackageMix";
import { StageFunnel } from "./charts/StageFunnel";
import {
  formatCompactMoney,
  formatHours,
  formatMoney,
  formatWeek,
} from "./charts/chart-theme";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "4w", label: "4 weeks" },
  { value: "12w", label: "12 weeks" },
  { value: "all", label: "All time" },
];

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Dashboard content loading">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-lg lg:col-span-8" />
        <Skeleton className="h-72 rounded-lg lg:col-span-4" />
      </div>
    </LoadingRegion>
  );
}

function sparkOf(
  data: DashboardAnalytics,
  pick: (w: DashboardAnalytics["weekly"][number]) => number,
  format: (n: number) => string,
): SparkData {
  return {
    values: data.weekly.map(pick),
    labels: data.weekly.map((w) => formatWeek(w.week_start)),
    format,
  };
}

export function DashboardPage() {
  const { token, me } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>("12w");
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const promise = fetchDashboardAnalytics(token, range);
    if (!promise?.then) return;
    promise
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          describeError(err, { action: "load the dashboard", role: me?.role }),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token, range, me?.role, attempt]);

  function retry(): void {
    setError(null);
    setData(null);
    setAttempt((n) => n + 1);
  }

  const k = data?.kpis;
  // The response says which range it answers, so a stale one means a refetch is in flight.
  const loading = data !== null && data.range !== range;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {me?.organization.name ?? "Your workspace"} at a glance.
          </p>
        </div>
        <div
          role="group"
          aria-label="Time range"
          className="inline-flex rounded-md border border-border p-0.5"
        >
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={range === r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                range === r.value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && !data ? (
        <ErrorState
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      ) : data === null || k === undefined ? (
        <LoadingSkeleton />
      ) : (
        <div
          className={cn(
            "mt-4 space-y-4 transition-opacity duration-150 motion-reduce:transition-none",
            loading && "opacity-60",
          )}
          aria-busy={loading}
        >
          {error && (
            <p className="text-sm text-destructive-foreground" role="alert">
              {error.message}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiTile
              label="Open pipeline"
              value={`${formatCompactMoney(Number(k.open_pipeline_value))}/mo`}
              hint={`${formatMoney(Number(k.open_pipeline_value))} across ${k.open_opportunities} open`}
              href="/opportunities"
              spark={sparkOf(
                data,
                (w) => Number(w.value_created),
                (n) => `${formatCompactMoney(n)} drafted`,
              )}
            />
            <KpiTile
              label="Win rate"
              value={k.win_rate === null ? "n/a" : `${Math.round(k.win_rate)}%`}
              hint={`${k.won} won · ${k.lost} lost`}
              href="/opportunities"
            />
            <KpiTile
              label="Awaiting approval"
              value={String(k.awaiting_approval)}
              hint={
                k.awaiting_approval === 1
                  ? "version needs a decision"
                  : "versions need a decision"
              }
              href="/approvals"
            />
            <KpiTile
              label="Median approval time"
              value={
                k.median_approval_hours === null
                  ? "n/a"
                  : formatHours(k.median_approval_hours)
              }
              hint="from request to decision"
              href="/approvals"
              spark={sparkOf(
                data,
                (w) => w.approvals_decided,
                (n) => `${n} decided`,
              )}
            />
            <AiHealthTile
              ai={data.ai}
              successRate={k.ai_success_rate}
              generations={k.ai_generations}
            />
          </div>

          <div className="grid gap-4 lg:auto-rows-[minmax(17rem,calc((100dvh-21.5rem)/2))] lg:grid-cols-12">
            <ActivityChart weekly={data.weekly} />
            <OutcomeDonut stages={data.stages} winRate={k.win_rate} />
            <StageFunnel stages={data.stages} />
            <PackageMix packages={data.packages} />
            <section
              aria-label="Recent activity"
              className="flex h-80 min-h-0 flex-col rounded-lg border border-border bg-card p-4 lg:col-span-4 lg:h-auto"
            >
              <h2 className="mb-2 text-sm font-medium text-foreground">
                Recent activity
              </h2>
              <div className="min-h-0 flex-1 [&>[role=region]]:max-h-full">
                <ActivityTimeline
                  contained
                  emptyMessage="No activity yet. Actions on opportunities will show up here."
                />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
