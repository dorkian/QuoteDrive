import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import {
  fetchCustomers,
  fetchOpportunities,
  type Customer,
  type Opportunity,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Opportunities loading">
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </LoadingRegion>
  );
}

export function OpportunitiesListPage() {
  const { token, me } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(
    null,
  );
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      return;
    }
    Promise.all([fetchOpportunities(token), fetchCustomers(token)])
      .then(([fetchedOpportunities, fetchedCustomers]) => {
        setOpportunities(fetchedOpportunities);
        setCustomers(fetchedCustomers);
      })
      .catch((err: unknown) =>
        setError(
          describeError(err, {
            action: "load opportunities",
            role: me?.role,
          }),
        ),
      );
  }, [token, me?.role, attempt]);

  function retry(): void {
    setError(null);
    setOpportunities(null);
    setCustomers(null);
    setAttempt((n) => n + 1);
  }

  const isLoading = opportunities === null || customers === null;
  const customerNameById = new Map(
    (customers ?? []).map((customer) => [customer.id, customer.name]),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-navy-50">
        Opportunities
      </h1>
      <p className="mt-1 text-sm text-navy-300">
        Every opportunity in the Northstar workspace.
      </p>

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : opportunities && opportunities.length === 0 ? (
        <EmptyState message="No opportunities yet." />
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {opportunities?.map((opportunity) => (
            <li key={opportunity.id}>
              <Link
                to={`/opportunities/${opportunity.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-navy-800 bg-navy-900 px-4 py-3 transition-colors duration-150 hover:border-lime-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy-50">
                    {opportunity.title}
                  </span>
                  <span className="block text-xs text-navy-300">
                    {customerNameById.get(opportunity.customer_id) ??
                      `Customer #${opportunity.customer_id}`}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-navy-800 px-3 py-1 text-xs font-medium text-navy-50">
                  {opportunity.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
