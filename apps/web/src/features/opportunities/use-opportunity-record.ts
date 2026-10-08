import { useEffect, useState } from "react";

import {
  fetchCustomer,
  fetchOpportunity,
  fetchProposalVersions,
  type Customer,
  type Opportunity,
  type ProposalVersion,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";

const NOT_FOUND: ErrorDescription = {
  message: "This opportunity doesn't exist or isn't in your organization.",
  retryable: false,
};

/** Loads one opportunity with its versions and customer; shared by the panel and the full page. */
export function useOpportunityRecord(id: number | null) {
  const { token, me } = useAuth();
  const invalid = id === null || !Number.isInteger(id) || id <= 0;
  const [loaded, setLoaded] = useState<{
    id: number;
    opportunity: Opportunity;
    versions: ProposalVersion[];
    customer: Customer | null;
  } | null>(null);
  const [failure, setFailure] = useState<{
    id: number;
    error: ErrorDescription;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token || invalid) return;
    let cancelled = false;
    Promise.all([fetchOpportunity(token, id), fetchProposalVersions(token, id)])
      .then(async ([opportunity, versions]) => {
        // The customer name is context, not essential: a failure leaves it out.
        const customer = await fetchCustomer(
          token,
          opportunity.customer_id,
        ).catch(() => null);
        if (!cancelled) setLoaded({ id, opportunity, versions, customer });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure({
          id,
          error: describeError(err, {
            action: "load this opportunity",
            subject: "opportunity",
            role: me?.role,
          }),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [token, id, invalid, me?.role, attempt]);

  // A record loaded for another id is stale: show loading, not the previous deal.
  const current = loaded && loaded.id === id ? loaded : null;
  const error = invalid
    ? NOT_FOUND
    : failure && failure.id === id
      ? failure.error
      : null;

  return {
    opportunity: current?.opportunity ?? null,
    versions: current?.versions ?? null,
    customer: current?.customer ?? null,
    error,
    setOpportunity: (opportunity: Opportunity) =>
      setLoaded((prev) =>
        prev && prev.id === opportunity.id ? { ...prev, opportunity } : prev,
      ),
    retry: () => {
      setFailure(null);
      setLoaded(null);
      setAttempt((n) => n + 1);
    },
  };
}
