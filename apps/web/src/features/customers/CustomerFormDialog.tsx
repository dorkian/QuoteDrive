import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Customer, CustomerInput } from "../../lib/api";

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer being edited; omit to create a new one. */
  customer?: Customer;
  /** Rejects with a user-facing message on failure. */
  onSubmit: (input: CustomerInput) => Promise<void>;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSubmit,
}: CustomerFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CustomerForm
          customer={customer}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

// Mounted only while the dialog is open, so every open starts from the
// customer's current values instead of a stale draft.
function CustomerForm({
  customer,
  onSubmit,
  onCancel,
}: {
  customer?: Customer;
  onSubmit: (input: CustomerInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [industry, setIndustry] = useState(customer?.industry ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = customer !== undefined;
  const trimmedName = name.trim();

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!trimmedName) {
      setError("Enter a customer name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: trimmedName, industry: industry.trim() || null });
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
        <DialogTitle>{isEdit ? "Edit customer" : "New customer"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Changes are recorded in the audit log."
            : "Customers hold the opportunities you build proposals for."}
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Customer name
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            autoFocus
            required
            aria-invalid={error !== null && !trimmedName}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          <span>
            Industry{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </span>
          <Input
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            maxLength={255}
          />
        </label>
        {error && (
          <p className="text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create customer"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
