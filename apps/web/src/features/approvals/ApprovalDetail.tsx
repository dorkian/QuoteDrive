import { CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { StatusBadge } from "@/components/StatusBadge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CARD_CLASSES } from "@/components/ui/variants";
import { cn } from "@/lib/utils";

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
import { describeError, type ErrorDescription } from "../../lib/errors";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import { VersionComparison } from "./VersionComparison";

const NOT_FOUND: ErrorDescription = {
  message: "This approval request doesn't exist or isn't in your organization.",
  retryable: false,
};

type ConfirmMode = "idle" | "confirm_approve" | "confirm_request_changes";

export function ApprovalDetail() {
  const { token, me } = useAuth();
  const { requestId } = useParams<{ requestId: string }>();
  const id = Number(requestId);

  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [version, setVersion] = useState<ProposalVersion | null>(null);
  const [previousVersion, setPreviousVersion] =
    useState<ProposalVersion | null>(null);
  const [loadError, setLoadError] = useState<ErrorDescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null);

  const isInvalidId = !Number.isInteger(id) || id <= 0;
  // Approval requests are Approver/Admin-only on the API; gate before fetching
  // so other roles get an explanation instead of a failed load.
  const isAllowed = me ? canDecideApproval(me.role) : false;

  const [prevId, setPrevId] = useState(id);
  if (!Object.is(id, prevId)) {
    setPrevId(id);
    setRequest(null);
    setVersion(null);
    setPreviousVersion(null);
    setLoadError(null);
    setError(null);
    setDecisionSuccess(null);
    setConfirmMode("idle");
    setComment("");
    setCommentError(null);
  }

  useEffect(() => {
    if (!token || isInvalidId || !isAllowed) {
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
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            describeError(err, {
              action: "load this approval request",
              subject: "approval request",
              role: me?.role,
            }),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, id, isInvalidId, isAllowed, me?.role, attempt]);

  function retry(): void {
    setLoadError(null);
    setRequest(null);
    setVersion(null);
    setPreviousVersion(null);
    setAttempt((n) => n + 1);
  }

  function describeDecisionError(err: unknown, action: string): string {
    return describeError(err, { action, role: me?.role }).message;
  }

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
      toast.success("Proposal version approved");
    } catch (err) {
      const message = describeDecisionError(err, "approve this request");
      setError(message);
      toast.error(message);
    } finally {
      setConfirmMode("idle");
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
      toast.success("Changes requested");
    } catch (err) {
      const message = describeDecisionError(
        err,
        "request changes on this version",
      );
      setError(message);
      toast.error(message);
    } finally {
      setConfirmMode("idle");
      setSubmitting(false);
    }
  }

  const blockingError = isInvalidId ? NOT_FOUND : loadError;
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
        className="-my-2 inline-flex items-center rounded-sm py-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        ← Approvals
      </Link>

      {error && (
        <p className="mt-4 text-sm text-destructive-foreground" role="alert">
          {error}
        </p>
      )}

      {decisionSuccess && (
        <div
          role="status"
          className={cn(
            CARD_CLASSES,
            "mt-4 flex items-center gap-2 p-4 text-sm text-foreground",
          )}
        >
          <CircleCheck
            aria-hidden="true"
            className="size-4 shrink-0 text-primary"
          />
          {decisionSuccess}
        </div>
      )}

      {me && !isAllowed ? (
        <ForbiddenState
          role={me.role}
          what="review approval requests"
          allowed="Approvers and Admins"
        />
      ) : blockingError ? (
        <ErrorState
          className="mt-4"
          message={blockingError.message}
          onRetry={blockingError.retryable ? retry : undefined}
        />
      ) : request === null || version === null ? (
        <LoadingRegion label="Approval detail loading">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-48" />
          </div>
        </LoadingRegion>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          <header className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-balance text-foreground">
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
            <div className="self-start sm:self-auto">
              <StatusBadge status={request.status} />
            </div>
          </header>

          {/* Proposal Content */}
          <section
            aria-label="Proposal details"
            className={cn(CARD_CLASSES, "p-4")}
          >
            <h2 className="text-sm font-semibold text-foreground">
              Proposal content
            </h2>
            {version.content_json.lines.length === 0 ? (
              <EmptyState className="mt-2" message="No package lines." />
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {version.content_json.lines.map((line, index) => (
                  <li
                    key={index}
                    className="rounded-md border border-border bg-navy-950 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {line.name} · qty {line.quantity}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${line.unit_estimate}/mo · line total ${line.line_total}
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

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Total: ${version.total_estimate}
                </p>
                <p className="text-xs text-navy-400">
                  Illustrative planning estimate only.
                </p>
              </div>
            </div>
          </section>

          {/* Version Comparison */}
          <VersionComparison current={version} previous={previousVersion} />

          {/* Decision Controls */}
          {showDecisionControls && (
            <section
              aria-label="Decision controls"
              className={cn(CARD_CLASSES, "p-4")}
            >
              <h2 className="text-sm font-semibold text-foreground">
                Decision
              </h2>

              {isOwner ? (
                <p className="mt-2 text-sm text-warning-foreground">
                  You submitted this version and cannot approve or request
                  changes on your own proposal.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
                    Comment
                    <Textarea
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
                      aria-invalid={commentError ? true : undefined}
                    />
                  </label>

                  {commentError && (
                    <p
                      className="text-xs text-destructive-foreground"
                      role="alert"
                    >
                      {commentError}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-3">
                    <Button
                      onClick={() => setConfirmMode("confirm_approve")}
                      disabled={submitting}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
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
                      className="border-red-500/40 text-destructive-foreground hover:bg-red-500/10"
                    >
                      Request changes
                    </Button>
                  </div>

                  <AlertDialog
                    open={confirmMode !== "idle"}
                    onOpenChange={(open) => {
                      // Keep the dialog up while the decision is in flight.
                      if (!open && !submitting) {
                        setConfirmMode("idle");
                      }
                    }}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {confirmMode === "confirm_request_changes"
                            ? "Confirm request changes and fork draft?"
                            : "Confirm approval of this version?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {confirmMode === "confirm_request_changes"
                            ? "The submitter gets your comment and a new draft version is created for their changes."
                            : `Version ${request.version_number} of ${request.opportunity_title} becomes approved and can be shared with the client.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={submitting}>
                          Cancel
                        </AlertDialogCancel>
                        {confirmMode === "confirm_request_changes" ? (
                          <Button
                            variant="destructive"
                            onClick={() => void handleRequestChanges()}
                            disabled={submitting}
                          >
                            {submitting
                              ? "Requesting…"
                              : "Confirm request changes"}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => void handleApprove()}
                            disabled={submitting}
                          >
                            {submitting ? "Approving…" : "Confirm approve"}
                          </Button>
                        )}
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
