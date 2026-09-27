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
import { cn } from "@/lib/utils";
import type { CatalogueItem, CatalogueItemInput } from "../../lib/api";

const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

interface CatalogueItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The item being edited; omit to create one. */
  item?: CatalogueItem;
  /** Rejects with a user-facing message on failure. */
  onSubmit: (input: CatalogueItemInput) => Promise<void>;
}

export function CatalogueItemDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
}: CatalogueItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CatalogueItemForm
          item={item}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function CatalogueItemForm({
  item,
  onSubmit,
  onCancel,
}: {
  item?: CatalogueItem;
  onSubmit: (input: CatalogueItemInput) => Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = item !== undefined;
  const [type, setType] = useState<CatalogueItem["type"]>(
    item?.type ?? "package",
  );
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [price, setPrice] = useState(item?.base_monthly_estimate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return "Enter a name.";
    if (!category.trim()) return "Enter a category.";
    if (!PRICE_PATTERN.test(price.trim())) {
      return "Enter a monthly price of 0 or more, with at most two decimals.";
    }
    return null;
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        type,
        name: name.trim(),
        category: category.trim(),
        base_monthly_estimate: price.trim(),
        active: item?.active ?? true,
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
          {isEdit ? `Edit ${item.name}` : "New catalogue item"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Saved proposal versions keep the price they were built with."
            : "Packages are quoted per vehicle; add-ons attach to a package."}
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        {!isEdit && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Type
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as CatalogueItem["type"])
              }
              className={cn(FIELD_CLASSES, "h-10")}
            >
              <option value="package">Package</option>
              <option value="add_on">Add-on</option>
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Name
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            autoFocus
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Category
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={64}
              placeholder="e.g. electric_city"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Monthly price ($)
            <Input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="decimal"
              placeholder="649.00"
              className="tabular-nums"
            />
          </label>
        </div>
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
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create item"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
