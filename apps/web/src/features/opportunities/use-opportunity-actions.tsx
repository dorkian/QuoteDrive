import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  createProposalVersion,
  updateOpportunity,
  type Customer,
  type Opportunity,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError } from "../../lib/errors";
import { canEditProposals } from "../../lib/roles";
import {
  OpportunityFormDialog,
  type OpportunityFormValues,
} from "./OpportunityFormDialog";
import type { NextStepAction } from "./next-step";

/** Create-draft and edit for one opportunity, shared by the panel and the full page. */
export function useOpportunityActions({
  opportunity,
  customer,
  onUpdated,
}: {
  opportunity: Opportunity | null;
  customer: Customer | null;
  onUpdated: (opportunity: Opportunity) => void;
}) {
  const { token, me } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Bumped after an edit so the activity history refetches.
  const [activityKey, setActivityKey] = useState(0);
  const editable = !!me && canEditProposals(me.role);

  async function createDraft(): Promise<void> {
    if (!token || !opportunity) return;
    setCreating(true);
    setActionError(null);
    try {
      const version = await createProposalVersion(token, opportunity.id);
      toast.success(`Draft version ${version.version_number} created`);
      navigate(`/opportunities/${opportunity.id}/versions/${version.id}`);
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

  async function saveEdit(values: OpportunityFormValues): Promise<void> {
    if (!token || !opportunity) return;
    try {
      const updated = await updateOpportunity(token, opportunity.id, {
        title: values.title,
        status: values.status,
      });
      onUpdated(updated);
    } catch (err) {
      throw new Error(
        describeError(err, {
          action: "save this opportunity",
          subject: "opportunity",
          role: me?.role,
        }).message,
      );
    }
    setEditing(false);
    setActivityKey((n) => n + 1);
    toast.success("Opportunity saved");
  }

  function run(action: Exclude<NextStepAction, { kind: "brief" }>): void {
    if (!opportunity) return;
    if (action.kind === "create-draft") void createDraft();
    else
      navigate(`/opportunities/${opportunity.id}/versions/${action.versionId}`);
  }

  const dialog =
    editable && opportunity ? (
      <OpportunityFormDialog
        mode="edit"
        opportunity={opportunity}
        customerName={customer?.name ?? "this customer"}
        open={editing}
        onOpenChange={setEditing}
        onSubmit={saveEdit}
      />
    ) : null;

  return {
    editable,
    creating,
    actionError,
    activityKey,
    setEditing,
    run,
    dialog,
  };
}
