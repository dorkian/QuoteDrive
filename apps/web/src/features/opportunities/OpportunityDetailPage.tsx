import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

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
  fetchOpportunity,
  fetchProposalVersions,
  type Opportunity,
  type ProposalVersion,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";
import { canEditProposals } from "../../lib/roles";

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

  useEffect(() => {
    if (!token || isInvalidId) {
      return;
    }
    Promise.all([fetchOpportunity(token, id), fetchProposalVersions(token, id)])
      .then(([fetchedOpportunity, fetchedVersions]) => {
        setOpportunity(fetchedOpportunity);
        setVersions(fetchedVersions);
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
      navigate(`/opportunities/${id}/versions/${version.id}`);
    } catch (err) {
      setActionError(
        describeError(err, {
          action: "create a draft version",
          role: me?.role,
        }).message,
      );
      setCreating(false);
    }
  }

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
            <h1 className="min-w-0 text-xl font-semibold tracking-tight text-balance text-foreground">
              {opportunity.title}
            </h1>
            {me && canEditProposals(me.role) && (
              <Button
                onClick={() => void handleCreateDraft()}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create draft version"}
              </Button>
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
        </>
      )}
    </div>
  );
}
