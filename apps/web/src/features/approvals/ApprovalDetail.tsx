import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  approveRequest,
  canDecideApproval,
  fetchApprovalRequest,
  fetchProposalVersion,
  fetchProposalVersions,
  isBlank,
  requestChanges,
  type ApprovalRequest,
  type ProposalVersion,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { VersionComparison } from "./VersionComparison";

type ConfirmMode = "idle" | "confirm_approve" | "confirm_request_changes";

export function ApprovalDetail() {
  const { token, me } = useAuth();
  const { requestId } = useParams<{ requestId: string }>();
  const id = Number(requestId);

  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [version, setVersion] = useState<ProposalVersion | null>(null);
  const [previousVersion, setPreviousVersion] =
    useState<ProposalVersion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null);

  const isInvalidId = Number.isNaN(id);
  const displayError = isInvalidId ? "Invalid approval request ID." : error;

  const [prevId, setPrevId] = useState(id);
  if (!Object.is(id, prevId)) {
    setPrevId(id);
    setRequest(null);
    setVersion(null);
    setPreviousVersion(null);
    setError(null);
    setDecisionSuccess(null);
    setConfirmMode("idle");
    setComment("");
    setCommentError(null);
  }

  useEffect(() => {
    if (!token || Number.isNaN(id)) {
      return;
    }

    let cancelled = false;

    fetchApprovalRequest(token, id)
      .then(async (fetchedRequest) => {
        if (cancelled) return;
        const [fetchedVersion, allVersions] = await Promise.all([
          fetchProposalVersion(token, fetchedRequest.proposal_version_id),
          fetchProposalVersions(token, fetchedRequest.opportunity_id),
        ]);
        if (cancelled) return;
        setRequest(fetchedRequest);
        setVersion(fetchedVersion);

        const prev =
          allVersions.find(
            (v) => v.version_number === fetchedVersion.version_number - 1,
          ) ?? null;
        setPreviousVersion(prev);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Couldn't load this approval request. Try refreshing the page.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, id]);

  async function handleApprove(): Promise<void> {
    if (!token || !request) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await approveRequest(
        token,
        request.id,
        comment.trim() || undefined,
      );
      setRequest((prev) => (prev ? { ...prev, ...updated } : updated));
      setDecisionSuccess("Proposal version approved successfully.");
      setConfirmMode("idle");
    } catch {
      setError("Failed to approve request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestChanges(): Promise<void> {
    if (!token || !request) {
      return;
    }
    if (isBlank(comment)) {
      setCommentError("A comment is required when requesting changes.");
      setConfirmMode("idle");
      return;
    }
    setCommentError(null);
    setSubmitting(true);
    setError(null);
    try {
      const updated = await requestChanges(token, request.id, comment.trim());
      setRequest((prev) => (prev ? { ...prev, ...updated } : updated));
      setDecisionSuccess(
        "Changes requested. A new draft version has been forked.",
      );
      setConfirmMode("idle");
    } catch {
      setError("Failed to request changes. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading = (request === null || version === null) && !displayError;
  const isOwner = !!(me && version && me.user.id === version.created_by);
  const showDecisionControls =
    !!request &&
    !!version &&
    request.status === "pending" &&
    !!me &&
    canDecideApproval(me.role);

  return (
    <div>
      <Link
        to="/approvals"
        className="text-xs text-navy-300 hover:text-lime-400"
      >
        ← Approvals
      </Link>

      {displayError && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {displayError}
        </p>
      )}

      {decisionSuccess && (
        <div
          role="status"
          className="mt-4 rounded-md border border-lime-800 bg-lime-950 p-4 text-sm text-lime-300"
        >
          {decisionSuccess}
        </div>
      )}

      {isLoading ? (
        <div
          className="mt-6 flex flex-col gap-4"
          role="status"
          aria-label="Approval detail loading"
        >
          <div className="h-10 animate-pulse rounded-md border border-navy-800 bg-navy-900" />
          <div className="h-48 animate-pulse rounded-md border border-navy-800 bg-navy-900" />
        </div>
      ) : (
        request &&
        version && (
          <div className="mt-4 flex flex-col gap-6">
            <header className="flex flex-col gap-2 border-b border-navy-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-navy-50">
                  {request.opportunity_title} · Version {request.version_number}
                </h1>
                <p className="mt-1 text-xs text-navy-400">
                  Submitted by {request.requested_by_name} on{" "}
                  <time dateTime={request.created_at}>
                    {new Date(request.created_at).toLocaleDateString()}
                  </time>{" "}
                  · Assigned to {request.assigned_to_name}
                </p>
              </div>
              <span
                className={`self-start rounded-full px-3 py-1 text-xs font-medium sm:self-auto ${
                  request.status === "approved"
                    ? "border border-lime-800 bg-lime-950 text-lime-400"
                    : request.status === "changes_requested"
                      ? "border border-red-800 bg-red-950 text-red-400"
                      : "border border-amber-800 bg-amber-950 text-amber-300"
                }`}
              >
                {request.status}
              </span>
            </header>

            {/* Proposal Content */}
            <section
              aria-label="Proposal details"
              className="rounded-md border border-navy-800 bg-navy-900 p-4"
            >
              <h2 className="text-sm font-semibold text-navy-50">
                Proposal Content
              </h2>
              {version.content_json.lines.length === 0 ? (
                <p className="mt-2 text-sm text-navy-300">No package lines.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {version.content_json.lines.map((line, index) => (
                    <li
                      key={index}
                      className="rounded-md border border-navy-800 bg-navy-950 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-navy-50">
                          {line.name} · qty {line.quantity}
                        </p>
                        <p className="text-xs text-navy-300">
                          ${line.unit_estimate}/mo · line total $
                          {line.line_total}
                        </p>
                      </div>
                      {line.assumptions && (
                        <p className="mt-1 text-xs text-navy-400">
                          {line.assumptions}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-navy-800 pt-3">
                <div>
                  <p className="text-sm font-medium text-navy-50">
                    Total: ${version.total_estimate}
                  </p>
                  <p className="text-xs text-navy-400">
                    Illustrative planning estimate only.
                  </p>
                </div>
              </div>
            </section>

            {/* Version Comparison */}
            <VersionComparison
              current={version}
              previous={previousVersion}
            />

            {/* Decision Controls */}
            {showDecisionControls && (
              <section
                aria-label="Decision controls"
                className="rounded-md border border-navy-800 bg-navy-900 p-4"
              >
                <h2 className="text-sm font-semibold text-navy-50">Decision</h2>

                {isOwner ? (
                  <p className="mt-2 text-sm text-amber-300">
                    You submitted this version and cannot approve or request
                    changes on your own proposal.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-navy-200">
                      Feedback / Comment
                      <textarea
                        rows={3}
                        value={comment}
                        onChange={(e) => {
                          setComment(e.target.value);
                          if (commentError) {
                            setCommentError(null);
                          }
                        }}
                        disabled={submitting}
                        placeholder="Add notes or reason for changes..."
                        className="rounded-md border border-navy-700 bg-navy-950 p-2.5 text-sm text-navy-50 placeholder-navy-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400"
                      />
                    </label>

                    {commentError && (
                      <p className="text-xs text-red-400" role="alert">
                        {commentError}
                      </p>
                    )}

                    {confirmMode === "idle" ? (
                      <div className="mt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setConfirmMode("confirm_approve")}
                          disabled={submitting}
                          className="rounded-md bg-lime-400 px-4 py-2 text-sm font-medium text-navy-950 transition-colors duration-150 hover:bg-lime-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isBlank(comment)) {
                              setCommentError(
                                "A comment is required when requesting changes.",
                              );
                              return;
                            }
                            setConfirmMode("confirm_request_changes");
                          }}
                          disabled={submitting}
                          className="rounded-md border border-red-700 bg-red-950 px-4 py-2 text-sm font-medium text-red-300 transition-colors duration-150 hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Request Changes
                        </button>
                      </div>
                    ) : confirmMode === "confirm_approve" ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="text-sm text-navy-300">
                          Confirm approval of this version?
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleApprove()}
                          disabled={submitting}
                          className="rounded-md bg-lime-400 px-4 py-2 text-sm font-medium text-navy-950 transition-colors duration-150 hover:bg-lime-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submitting ? "Approving…" : "Confirm approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmMode("idle")}
                          disabled={submitting}
                          className="rounded-md px-4 py-2 text-sm font-medium text-navy-400 transition-colors duration-150 hover:text-navy-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="text-sm text-navy-300">
                          Confirm request changes and fork draft?
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleRequestChanges()}
                          disabled={submitting}
                          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submitting
                            ? "Requesting…"
                            : "Confirm request changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmMode("idle")}
                          disabled={submitting}
                          className="rounded-md px-4 py-2 text-sm font-medium text-navy-400 transition-colors duration-150 hover:text-navy-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )
      )}
    </div>
  );
}

