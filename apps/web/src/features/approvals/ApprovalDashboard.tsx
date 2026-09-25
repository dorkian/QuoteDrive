import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
      <h1 className="text-xl font-semibold tracking-tight text-navy-50">
        Pending approvals
      </h1>
      <p className="mt-1 text-sm text-navy-300">
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
                    className="flex flex-col gap-3 rounded-md border border-navy-800 bg-navy-900 p-4 transition-colors duration-150 hover:border-lime-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy-50">
                          {req.opportunity_title}
                        </span>
                        <span className="rounded-full bg-navy-800 px-2 py-0.5 text-xs text-navy-300">
                          v{req.version_number}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-navy-400">
                        Submitted by{" "}
                        <span className="text-navy-50">
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
                      <span className="whitespace-nowrap rounded-full border border-amber-800 bg-amber-950 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                        {req.status}
                      </span>
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
