import { useEffect, useState } from "react";

import { OpportunitiesTable } from "./OpportunitiesTable";
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

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Opportunities
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every opportunity in the Northstar workspace.
      </p>

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : opportunities.length === 0 ? (
        <EmptyState message="No opportunities yet." />
      ) : (
        <OpportunitiesTable
          opportunities={opportunities}
          customers={customers}
        />
      )}
    </div>
  );
}
