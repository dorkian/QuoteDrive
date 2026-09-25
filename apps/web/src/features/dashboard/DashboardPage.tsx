import { useEffect, useState } from "react";

import { ActivityTimeline } from "../../components/ActivityTimeline";
import {
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import { fetchDashboardSummary, type DashboardSummary } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";

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

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-navy-50">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-navy-300">
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
            <h2 className="text-sm font-medium text-navy-50">Opportunities</h2>
            {statusEntries.length === 0 ? (
              <p className="mt-2 text-sm text-navy-300">
                No opportunities yet. Create one to see it here.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {statusEntries.map(([status, count]) => (
                  <span
                    key={status}
                    className="rounded-full bg-navy-800 px-3 py-1 text-xs font-medium text-navy-50"
                  >
                    {status} · {count}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-navy-400">
              Approvals tracking arrives once the proposal workflow ships.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-medium text-navy-50">
              Recent activity
            </h2>
            <ActivityTimeline emptyMessage="No activity yet. Actions on opportunities will show up here." />
          </section>
        </div>
      )}
    </div>
  );
}
