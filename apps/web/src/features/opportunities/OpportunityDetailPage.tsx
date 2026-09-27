import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import {
  createProposalVersion,
  fetchCustomer,
  fetchOpportunity,
  fetchProposalVersions,
  updateOpportunity,
  type Customer,
  type Opportunity,
  type ProposalVersion,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";
import { canEditProposals } from "../../lib/roles";
import { DiscoveryBriefPanel } from "./DiscoveryBriefPanel";
import {
  OpportunityFormDialog,
  type OpportunityFormValues,
} from "./OpportunityFormDialog";

const NOT_FOUND: ErrorDescription = {
  message: "This opportunity doesn't exist or isn't in your organization.",
  retryable: false,
};

export function OpportunityDetailPage() {
  const { token, me } = useAuth();
  const navigate = useNavigate();
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const id = Number(opportunityId);
  const isInvalidId = !Number.isInteger(id) || id <= 0;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [versions, setVersions] = useState<ProposalVersion[] | null>(null);
  const [loadError, setLoadError] = useState<ErrorDescription | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  // Bumped after an edit so the activity history refetches.
  const [activityKey, setActivityKey] = useState(0);

  useEffect(() => {
    if (!token || isInvalidId) {
      return;
    }
    Promise.all([fetchOpportunity(token, id), fetchProposalVersions(token, id)])
      .then(([fetchedOpportunity, fetchedVersions]) => {
        setOpportunity(fetchedOpportunity);
        setVersions(fetchedVersions);
        // The customer name is context, not essential: a failure leaves it out.
        fetchCustomer(token, fetchedOpportunity.customer_id)
          .then(setCustomer)
          .catch(() => setCustomer(null));
      })
      .catch((err: unknown) =>
        setLoadError(
          describeError(err, {
            action: "load this opportunity",
            subject: "opportunity",
            role: me?.role,
          }),
        ),
      );
  }, [token, id, isInvalidId, me?.role, attempt]);

  function retry(): void {
    setLoadError(null);
    setOpportunity(null);
    setVersions(null);
    setAttempt((n) => n + 1);
  }

  async function handleCreateDraft(): Promise<void> {
    if (!token) {
      return;
    }
    setCreating(true);
    setActionError(null);
    try {
      const version = await createProposalVersion(token, id);
      toast.success(`Draft version ${version.version_number} created`);
      navigate(`/opportunities/${id}/versions/${version.id}`);
    } catch (err) {
      const message = describeError(err, {
        action: "create a draft version",
        role: me?.role,
      }).message;
      setActionError(message);
      toast.error(message);
      setCreating(false);
    }
  }

  async function handleEdit(values: OpportunityFormValues): Promise<void> {
    if (!token) {
      return;
    }
    let updated: Opportunity;
    try {
      updated = await updateOpportunity(token, id, {
        title: values.title,
        status: values.status,
      });
    } catch (err) {
      throw new Error(
        describeError(err, {
          action: "save this opportunity",
          subject: "opportunity",
          role: me?.role,
        }).message,
      );
    }
    setOpportunity(updated);
    setEditing(false);
    setActivityKey((n) => n + 1);
    toast.success("Opportunity saved");
  }

  const editable = !!me && canEditProposals(me.role);
  const error = isInvalidId ? NOT_FOUND : loadError;

  return (
    <div>
      <Link
        to="/opportunities"
        className="-my-2 inline-flex min-h-10 items-center rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        ← Opportunities
      </Link>

      {error ? (
        <ErrorState
          className="mt-4"
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      ) : opportunity === null || versions === null ? (
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
                {customer && <span>{customer.name}</span>}
                <StatusBadge status={opportunity.status} />
              </p>
            </div>
            {editable && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit details
                </Button>
                <Button
                  onClick={() => void handleCreateDraft()}
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Create draft version"}
                </Button>
              </div>
            )}
          </div>

          {actionError && (
            <p
              className="mt-4 text-sm text-destructive-foreground"
              role="alert"
            >
              {actionError}
            </p>
          )}

          {token && (
            <DiscoveryBriefPanel
              token={token}
              opportunity={opportunity}
              editable={editable}
              onSaved={setOpportunity}
            />
          )}

          <h2 className="mt-8 text-sm font-medium text-foreground">
            Proposal versions
          </h2>
          {versions.length === 0 ? (
            <EmptyState className="mt-2" message="No proposal versions yet." />
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {versions.map((version) => (
                <li key={version.id}>
                  <Link
                    to={`/opportunities/${id}/versions/${version.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors duration-150 hover:border-navy-700 hover:bg-navy-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="text-sm font-medium text-foreground">
                      Version {version.version_number}
                    </span>
                    <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ${version.total_estimate}
                      </span>
                      <StatusBadge status={version.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <section className="mt-10 border-t border-border pt-6">
            <h2 className="mb-4 text-sm font-medium text-foreground">
              Activity
            </h2>
            <ActivityTimeline
              key={activityKey}
              entityType="opportunity"
              entityId={opportunity.id}
              emptyMessage="No activity on this opportunity yet."
            />
          </section>

          {editable && (
            <OpportunityFormDialog
              mode="edit"
              opportunity={opportunity}
              customerName={customer?.name ?? "this customer"}
              open={editing}
              onOpenChange={setEditing}
              onSubmit={handleEdit}
            />
          )}
        </>
      )}
    </div>
  );
}
