import { Pencil } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { EntityPanel } from "@/components/EntityPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import type { Opportunity } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { OpportunityBody } from "./OpportunityBody";
import { useOpportunityActions } from "./use-opportunity-actions";
import { useOpportunityRecord } from "./use-opportunity-record";

/** An opportunity's details in a side panel, opened from the list without leaving it. */
export function OpportunityPanel({
  opportunityId,
  seed,
  onClose,
  onChanged,
}: {
  opportunityId: number | null;
  /** The list row, used to fill the header while the full record loads. */
  seed?: Opportunity;
  onClose: () => void;
  onChanged: (opportunity: Opportunity) => void;
}) {
  const { token } = useAuth();
  // Keep showing the last record while the panel animates closed.
  const [shownId, setShownId] = useState(opportunityId);
  if (opportunityId !== null && opportunityId !== shownId)
    setShownId(opportunityId);

  const record = useOpportunityRecord(shownId);
  const opportunity =
    record.opportunity ?? (seed && seed.id === shownId ? seed : null);
  const actions = useOpportunityActions({
    opportunity: record.opportunity,
    customer: record.customer,
    onUpdated: (updated) => {
      record.setOpportunity(updated);
      onChanged(updated);
    },
  });

  return (
    <>
      <EntityPanel
        open={opportunityId !== null}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={opportunity?.title ?? "Opportunity"}
        description={record.customer?.name}
        badge={
          opportunity && (
            <>
              <StatusBadge status={opportunity.status} />
              {opportunity.owner_name && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Avatar name={opportunity.owner_name} size="sm" />
                  {opportunity.owner_name}
                </span>
              )}
            </>
          )
        }
        fullPageHref={shownId ? `/opportunities/${shownId}` : undefined}
        footer={
          actions.editable && record.opportunity ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.setEditing(true)}
            >
              <Pencil aria-hidden="true" />
              Edit details
            </Button>
          ) : undefined
        }
      >
        {record.error ? (
          <ErrorState
            message={record.error.message}
            onRetry={record.error.retryable ? record.retry : undefined}
          />
        ) : !record.opportunity || !record.versions || !token ? (
          <LoadingRegion label="Opportunity loading">
            <Skeleton className="h-28" />
            <Skeleton className="mt-4 h-16" />
          </LoadingRegion>
        ) : (
          <>
            {actions.actionError && (
              <p
                role="alert"
                className="mb-3 text-sm text-destructive-foreground"
              >
                {actions.actionError}
              </p>
            )}
            <OpportunityBody
              token={token}
              opportunity={record.opportunity}
              versions={record.versions}
              editable={actions.editable}
              creating={actions.creating}
              activityKey={actions.activityKey}
              onAction={actions.run}
              onSaved={(updated) => {
                record.setOpportunity(updated);
                onChanged(updated);
              }}
            />
          </>
        )}
      </EntityPanel>
      {actions.dialog}
    </>
  );
}
