import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import {
  fetchApprovers,
  requestApproval,
  submitProposalVersion,
  type ApproverOption,
  type ProposalVersion,
  type Role,
} from "../../lib/api";
import { describeError } from "../../lib/errors";

/**
 * Finalized → Awaiting approval, assigned to one approver. Two API calls
 * (submit, then approval-request). If the second fails the version is already
 * submitted, so the button stays and retries only the request.
 */
export function SubmitForApproval({
  token,
  role,
  version,
  onChanged,
}: {
  token: string;
  role: Role;
  version: ProposalVersion;
  onChanged: (version: ProposalVersion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [approvers, setApprovers] = useState<ApproverOption[] | null>(null);
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once submit succeeded but the approval request did not.
  const [stranded, setStranded] = useState<ProposalVersion | null>(null);

  const visible = version.status === "proposal_drafted" || stranded !== null;

  useEffect(() => {
    if (!open || !visible || approvers !== null) return;
    let cancelled = false;
    fetchApprovers(token, version.id)
      .then((list) => {
        if (!cancelled) setApprovers(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          describeError(err, {
            action: "load approvers",
            subject: "proposal version",
            role,
          }).message,
        );
        setApprovers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, visible, approvers, token, version.id, role]);

  if (!visible) return null;

  function close(): void {
    if (busy) return;
    setOpen(false);
    // The version is submitted on the server; reflect that even if unassigned.
    if (stranded) onChanged(stranded);
  }

  async function confirm(): Promise<void> {
    setBusy(true);
    setError(null);
    let submitted = stranded;
    try {
      submitted ??= await submitProposalVersion(token, version.id);
      await requestApproval(token, version.id, Number(assignee));
    } catch (err) {
      if (submitted && submitted !== stranded) setStranded(submitted);
      setError(
        describeError(err, {
          action: submitted
            ? "assign an approver"
            : "submit this proposal version",
          subject: "proposal version",
          role,
        }).message,
      );
      setBusy(false);
      return;
    }
    const name = approvers?.find(
      (a) => String(a.user_id) === assignee,
    )?.display_name;
    setBusy(false);
    setStranded(null);
    setOpen(false);
    onChanged(submitted);
    toast.success(
      name ? `Submitted for approval to ${name}` : "Submitted for approval",
    );
  }

  return (
    <>
      <Button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {stranded ? "Assign approver" : "Submit for approval"}
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) close();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Submit version {version.version_number} for approval?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {stranded
                ? "The version was submitted, but no approver is assigned yet. Choose one to finish."
                : "Choose who reviews it. You can't edit the version while it waits for a decision."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="approver-select"
              className="text-sm font-medium text-foreground"
            >
              Approver
            </label>
            <select
              id="approver-select"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              disabled={busy || approvers === null}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
            >
              <option value="">
                {approvers === null
                  ? "Loading approvers…"
                  : "Select an approver"}
              </option>
              {approvers?.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.display_name} ({a.role === "admin" ? "Admin" : "Approver"})
                </option>
              ))}
            </select>
            {approvers?.length === 0 && !error && (
              <p className="text-xs text-muted-foreground">
                No one else in this workspace can approve. An Admin can change a
                member's role in Settings.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive-foreground" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              onClick={() => void confirm()}
              disabled={busy || assignee === ""}
            >
              {busy ? "Submitting…" : "Submit for approval"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
