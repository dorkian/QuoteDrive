import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FIELD_CLASSES, Input } from "@/components/ui/input";
import { formatStatus } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer, Opportunity } from "../../lib/api";
import { OPPORTUNITY_STATUSES } from "./opportunity-statuses";

export interface OpportunityFormValues {
  customer_id: number;
  title: string;
  status: string;
}

type OpportunityFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rejects with a user-facing message on failure. */
  onSubmit: (values: OpportunityFormValues) => Promise<void>;
} & (
  | { mode: "create"; customers: Customer[] }
  | { mode: "edit"; opportunity: Opportunity; customerName: string }
);

export function OpportunityFormDialog(props: OpportunityFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && (
        <OpportunityForm
          {...props}
          onCancel={() => props.onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function OpportunityForm(
  props: OpportunityFormDialogProps & { onCancel: () => void },
) {
  const isEdit = props.mode === "edit";
  const [customerId, setCustomerId] = useState(
    isEdit ? String(props.opportunity.customer_id) : "",
  );
  const [title, setTitle] = useState(isEdit ? props.opportunity.title : "");
  const [status, setStatus] = useState(
    isEdit ? props.opportunity.status : "open",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedTitle = title.trim();

  const statusOptions: string[] = [...OPPORTUNITY_STATUSES];
  if (!statusOptions.includes(status)) {
    statusOptions.push(status);
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!customerId) {
      setError("Choose a customer.");
      return;
    }
    if (!trimmedTitle) {
      setError("Enter an opportunity title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await props.onSubmit({
        customer_id: Number(customerId),
        title: trimmedTitle,
        status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <DialogContent
      onInteractOutside={(event) => {
        if (saving) event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit opportunity" : "New opportunity"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? `For ${props.customerName}. Changes are recorded in the activity history.`
            : "Start a deal for a customer, then build proposal versions on it."}
        </DialogDescription>
      </DialogHeader>
      <form
        className="mt-2 flex flex-col gap-4"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        {props.mode === "create" && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Customer
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className={cn(FIELD_CLASSES, "h-10")}
              required
              aria-invalid={error !== null && !customerId}
            >
              <option value="" disabled>
                Choose a customer
              </option>
              {props.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Title
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={255}
            placeholder="e.g. 2027 Fleet Renewal"
            autoFocus={isEdit}
            required
            aria-invalid={error !== null && !!customerId && !trimmedTitle}
          />
        </label>
        {isEdit && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={cn(FIELD_CLASSES, "h-10")}
            >
              {statusOptions.map((value) => (
                <option key={value} value={value}>
                  {formatStatus(value)}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p className="text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={props.onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Create opportunity"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
