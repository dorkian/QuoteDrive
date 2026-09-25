import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import {
  canDecideApproval,
  fetchApprovalRequests,
  type ApprovalRequest,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";

function PageHeading() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Pending approvals
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review and decide on submitted proposal versions.
      </p>
    </>
  );
}

export function ApprovalDashboard() {
  const { token, me } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);

  const isAllowed = me ? canDecideApproval(me.role) : false;

  useEffect(() => {
    if (!token || !isAllowed) {
      return;
    }
    fetchApprovalRequests(token, "pending")
      .then(setRequests)
      .catch((err: unknown) =>
        setError(
          describeError(err, {
            action: "load pending approvals",
            role: me?.role,
          }),
        ),
      );
  }, [token, isAllowed, me?.role, attempt]);

  function retry(): void {
    setError(null);
    setRequests(null);
    setAttempt((n) => n + 1);
  }

  if (me && !isAllowed) {
    return (
      <div>
        <PageHeading />
        <ForbiddenState
          role={me.role}
          what="review approval requests"
          allowed="Approvers and Admins"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeading />

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      ) : requests === null ? (
        <LoadingRegion label="Approvals loading">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </LoadingRegion>
      ) : (
        <div className="mt-6">
          {requests.length === 0 ? (
            <EmptyState className="" message="No pending approvals." />
          ) : (
            <ul className="flex flex-col gap-3">
              {requests.map((req) => (
                <li key={req.id}>
                  <Link
                    to={`/approvals/${req.id}`}
                    className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 transition-colors duration-150 hover:border-navy-700 hover:bg-navy-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {req.opportunity_title}
                        </span>
                        <Badge variant="outline">v{req.version_number}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-navy-400">
                        Submitted by{" "}
                        <span className="text-foreground">
                          {req.requested_by_name}
                        </span>{" "}
                        on{" "}
                        <time dateTime={req.created_at}>
                          {new Date(req.created_at).toLocaleDateString()}
                        </time>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                      <span className="whitespace-nowrap text-xs text-navy-400">
                        Assigned to: {req.assigned_to_name}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
