import { useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  recordProposalOutcome,
  shareProposalVersion,
  type ProposalOutcome,
  type ProposalVersion,
} from "../../lib/api";
import { describeError } from "../../lib/errors";
import type { Role } from "../../lib/api";

const OUTCOMES: { value: ProposalOutcome; label: string; hint: string }[] = [
  {
    value: "won",
    label: "Won",
    hint: "The customer accepted. The opportunity is marked Won.",
  },
  {
    value: "lost",
    label: "Lost",
    hint: "The customer declined. The opportunity is marked Lost.",
  },
  {
    value: "expired",
    label: "Expired",
    hint: "No answer in time. The opportunity stays open for a new version.",
  },
];

type Mode = "idle" | "share" | "outcome";

/**
 * After approval: Approved → Shared → Won / Lost / Expired. Nothing is sent to
 * the customer; these record what happened outside QuoteDrive.
 */
export function VersionLifecycleActions({
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
  const [mode, setMode] = useState<Mode>("idle");
  const [outcome, setOutcome] = useState<ProposalOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (version.status !== "approved" && version.status !== "shared") {
    return null;
  }

  function open(next: Mode): void {
    setError(null);
    setOutcome(null);
    setMode(next);
  }

  async function confirm(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (mode === "share") {
        onChanged(await shareProposalVersion(token, version.id));
        toast.success(`Version ${version.version_number} marked as shared`);
      } else if (outcome) {
        onChanged(await recordProposalOutcome(token, version.id, outcome));
        toast.success(
          `Outcome recorded: ${OUTCOMES.find((o) => o.value === outcome)?.label}`,
        );
      }
      setMode("idle");
    } catch (err) {
      setError(
        describeError(err, {
          action: mode === "share" ? "share this version" : "record outcomes",
          subject: "proposal version",
          role,
        }).message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {version.status === "approved" ? (
        <Button onClick={() => open("share")}>Mark as shared</Button>
      ) : (
        <Button onClick={() => open("outcome")}>Record outcome</Button>
      )}

      <AlertDialog
        open={mode !== "idle"}
        onOpenChange={(isOpen) => {
          if (!isOpen && !busy) setMode("idle");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mode === "share"
                ? `Mark version ${version.version_number} as shared?`
                : `Record the outcome of version ${version.version_number}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "share"
                ? "Records that this approved version went to the customer. QuoteDrive doesn't send anything."
                : "This closes the version. It can't be changed afterwards."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {mode === "outcome" && (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Outcome</legend>
              {OUTCOMES.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm transition-colors duration-150 hover:bg-navy-800/50",
                    outcome === option.value && "border-primary bg-navy-800/50",
                  )}
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={option.value}
                    checked={outcome === option.value}
                    onChange={() => setOutcome(option.value)}
                    className="mt-0.5 size-4 accent-lime-400"
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      {option.label}
                    </span>
                    <span className="block text-muted-foreground">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {error && (
            <p className="text-sm text-destructive-foreground" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              onClick={() => void confirm()}
              disabled={busy || (mode === "outcome" && outcome === null)}
            >
              {busy
                ? "Saving…"
                : mode === "share"
                  ? "Mark as shared"
                  : "Record outcome"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
