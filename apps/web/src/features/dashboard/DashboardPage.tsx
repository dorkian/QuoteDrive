import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "../../components/ActivityTimeline";
import { formatStatus } from "@/lib/format";
import {
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import { fetchDashboardSummary, type DashboardSummary } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";

function KpiCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card role="group" aria-label={`${label}: ${value}`}>
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums tracking-tight",
            highlight ? "text-primary" : "text-foreground",
          )}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Dashboard content loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </LoadingRegion>
  );
}

export function DashboardPage() {
  const { token, me } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      return;
    }
    const promise = fetchDashboardSummary(token);
    if (!promise?.then) {
      return;
    }
    promise.then(setSummary).catch((err: unknown) =>
      setError(
        describeError(err, {
          action: "load the dashboard",
          role: me?.role,
        }),
      ),
    );
  }, [token, me?.role, attempt]);

  function retry(): void {
    setError(null);
    setSummary(null);
    setAttempt((n) => n + 1);
  }

  const statusEntries = summary
    ? Object.entries(summary.opportunities_by_status)
    : [];
  const total = statusEntries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Northstar workspace at a glance.
      </p>

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      ) : summary === null ? (
        <LoadingSkeleton />
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="text-sm font-medium text-foreground">
              Opportunities by status
            </h2>
            {statusEntries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No opportunities yet. Create one to see it here.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KpiCard label="Total" value={total} highlight />
                {statusEntries.map(([status, count]) => (
                  <KpiCard
                    key={status}
                    label={formatStatus(status)}
                    value={count}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-4 text-sm font-medium text-foreground">
              Recent activity
            </h2>
            <ActivityTimeline emptyMessage="No activity yet. Actions on opportunities will show up here." />
          </section>
        </div>
      )}
    </div>
  );
}
