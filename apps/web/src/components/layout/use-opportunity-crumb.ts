import { useEffect, useState } from "react";

import { fetchOpportunity } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useCrumbLabel } from "./crumb-context";

/** Names the "Opportunity" breadcrumb after the real opportunity, for pages that only know its id. */
export function useOpportunityCrumb(
  opportunityId: number | null | undefined,
): void {
  const { token } = useAuth();
  const [named, setNamed] = useState<{ id: number; title: string } | null>(
    null,
  );

  useEffect(() => {
    if (!token || !opportunityId) return;
    let cancelled = false;
    // The title is decoration: on failure the generic "Opportunity" label stays.
    Promise.resolve(fetchOpportunity(token, opportunityId))
      .then((o) => !cancelled && setNamed({ id: o.id, title: o.title }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, opportunityId]);

  useCrumbLabel(
    named && named.id === opportunityId ? `/opportunities/${named.id}` : null,
    named?.title,
  );
}
