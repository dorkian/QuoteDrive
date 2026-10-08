import { useCrumbLabel } from "../../components/layout/crumb-context";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import { useAuth } from "../../lib/auth-context";
import { OpportunityBody } from "./OpportunityBody";
import { useOpportunityActions } from "./use-opportunity-actions";
import { useOpportunityRecord } from "./use-opportunity-record";

/** The full-page view of an opportunity: the same body as the side panel, with more room. */
export function OpportunityDetailPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const record = useOpportunityRecord(Number(opportunityId));
  const actions = useOpportunityActions({
    opportunity: record.opportunity,
    customer: record.customer,
    onUpdated: record.setOpportunity,
  });
  const opportunity = record.opportunity;
  useCrumbLabel(
    opportunity ? `/opportunities/${opportunity.id}` : null,
    opportunity?.title,
  );

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => navigate("/opportunities")}
      >
        ← Opportunities
      </Button>

      {record.error ? (
        <ErrorState
          className="mt-4"
          message={record.error.message}
          onRetry={record.error.retryable ? record.retry : undefined}
        />
      ) : !opportunity || !record.versions || !token ? (
        <LoadingRegion label="Opportunity loading" className="mt-4">
          <Skeleton className="h-24" />
        </LoadingRegion>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-balance text-foreground">
                {opportunity.title}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {record.customer && (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={record.customer.name} size="sm" />
                    {record.customer.name}
                  </span>
                )}
                <StatusBadge status={opportunity.status} />
              </p>
            </div>
            {actions.editable && (
              <Button
                variant="outline"
                onClick={() => actions.setEditing(true)}
              >
                <Pencil aria-hidden="true" />
                Edit details
              </Button>
            )}
          </div>

          {actions.actionError && (
            <p
              className="mt-4 text-sm text-destructive-foreground"
              role="alert"
            >
              {actions.actionError}
            </p>
          )}

          <div className="mt-5 max-w-4xl">
            <OpportunityBody
              token={token}
              opportunity={opportunity}
              versions={record.versions}
              editable={actions.editable}
              creating={actions.creating}
              activityKey={actions.activityKey}
              onAction={actions.run}
              onSaved={record.setOpportunity}
            />
          </div>
          {actions.dialog}
        </>
      )}
    </div>
  );
}
