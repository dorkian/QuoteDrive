import { useEffect, useState } from "react";

import {
  fetchAuditEvents,
  fetchDashboardSummary,
  type AuditEvent,
  type DashboardSummary,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

function describeEvent(event: AuditEvent): string {
  const verb = event.action === "create" ? "created" : "updated";
  const title =
    (event.after_json?.title as string | undefined) ?? `#${event.entity_id}`;
  return `Opportunity ${verb}: ${title}`;
}

function LoadingSkeleton() {
  return (
    <div
      className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Dashboard content loading"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-navy-800 bg-navy-900 p-4"
        >
          <div className="h-3 w-1/3 rounded bg-navy-700" />
          <div className="mt-4 h-6 w-2/3 rounded bg-navy-700" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    Promise.all([fetchDashboardSummary(token), fetchAuditEvents(token)])
      .then(([fetchedSummary, fetchedEvents]) => {
        setSummary(fetchedSummary);
        setEvents(fetchedEvents);
      })
      .catch(() =>
        setError("Couldn't load dashboard data. Try refreshing the page."),
      );
  }, [token]);

  const isLoading = summary === null || events === null;
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

      {error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {isLoading && !error ? (
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
            <h2 className="text-sm font-medium text-navy-50">
              Recent activity
            </h2>
            {events && events.length === 0 ? (
              <p className="mt-2 text-sm text-navy-300">
                No activity yet. Actions on opportunities will show up here.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {events?.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between rounded-md border border-navy-800 bg-navy-900 px-3 py-2 text-sm"
                  >
                    <span className="text-navy-50">{describeEvent(event)}</span>
                    <span className="text-xs text-navy-300">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
