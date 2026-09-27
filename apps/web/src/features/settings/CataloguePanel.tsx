import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import {
  createCatalogueItem,
  fetchCatalogueItems,
  updateCatalogueItem,
  type CatalogueItem,
  type CatalogueItemInput,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";
import { CatalogueItemDialog } from "./CatalogueItemDialog";

const TYPE_LABELS: Record<CatalogueItem["type"], string> = {
  package: "Package",
  add_on: "Add-on",
};

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; item: CatalogueItem };

export function CataloguePanel() {
  const { token, me } = useAuth();
  const [items, setItems] = useState<CatalogueItem[] | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [toggling, setToggling] = useState<CatalogueItem | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    // Always fetch everything: the toggle filters locally, so switching it
    // doesn't flash a loading state.
    fetchCatalogueItems(token, { includeInactive: true })
      .then(setItems)
      .catch((err: unknown) =>
        setError(
          describeError(err, { action: "load the catalogue", role: me?.role }),
        ),
      );
  }, [token, me?.role, attempt]);

  function retry(): void {
    setError(null);
    setItems(null);
    setAttempt((n) => n + 1);
  }

  function replace(updated: CatalogueItem): void {
    setItems(
      (current) =>
        current?.map((i) => (i.id === updated.id ? updated : i)) ?? null,
    );
  }

  async function handleSubmit(input: CatalogueItemInput): Promise<void> {
    if (!token || form.mode === "closed") {
      return;
    }
    try {
      if (form.mode === "create") {
        const created = await createCatalogueItem(token, input);
        setItems((current) => [...(current ?? []), created]);
        toast.success(`${created.name} added to the catalogue`);
      } else {
        const { type: _type, active: _active, ...changes } = input;
        const updated = await updateCatalogueItem(token, form.item.id, changes);
        replace(updated);
        toast.success(`${updated.name} saved`);
      }
    } catch (err) {
      throw new Error(
        describeError(err, {
          action: "save this catalogue item",
          subject: "catalogue item",
          role: me?.role,
        }).message,
      );
    }
    setForm({ mode: "closed" });
  }

  async function confirmToggle(): Promise<void> {
    if (!token || !toggling) {
      return;
    }
    setToggleBusy(true);
    setToggleError(null);
    try {
      const updated = await updateCatalogueItem(token, toggling.id, {
        active: !toggling.active,
      });
      replace(updated);
      toast.success(
        `${updated.name} ${updated.active ? "reactivated" : "deactivated"}`,
      );
      setToggling(null);
    } catch (err) {
      setToggleError(
        describeError(err, {
          action: "change this item",
          subject: "catalogue item",
          role: me?.role,
        }).message,
      );
    } finally {
      setToggleBusy(false);
    }
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={error.retryable ? retry : undefined}
      />
    );
  }
  if (items === null) {
    return (
      <LoadingRegion label="Catalogue loading" className="mt-4">
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </LoadingRegion>
    );
  }

  const inactiveCount = items.filter((i) => !i.active).length;
  const visible = [...items]
    .filter((i) => showInactive || i.active)
    .sort(
      (a, b) =>
        a.type.localeCompare(b.type) * -1 || a.name.localeCompare(b.name),
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">
          Packages and add-ons proposal managers can quote. Deactivate an item
          to retire it; saved versions keep their prices.
        </p>
        <Button onClick={() => setForm({ mode: "create" })}>
          <Plus aria-hidden="true" className="size-4" />
          New item
        </Button>
      </div>

      <label className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(event) => setShowInactive(event.target.checked)}
          className="size-4 accent-lime-400"
        />
        Show inactive items
        <span className="text-muted-foreground">({inactiveCount})</span>
      </label>

      {visible.length === 0 ? (
        <EmptyState className="mt-2" message="No catalogue items yet." />
      ) : (
        <div className="mt-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Item</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-40">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">
                      {item.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {TYPE_LABELS[item.type]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {item.category}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${item.base_monthly_estimate}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.active ? "default" : "outline"}>
                      {item.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => setForm({ mode: "edit", item })}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setToggleError(null);
                          setToggling(item);
                        }}
                      >
                        {item.active ? "Deactivate" : "Reactivate"}
                        <span className="sr-only"> {item.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CatalogueItemDialog
        open={form.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) setForm({ mode: "closed" });
        }}
        item={form.mode === "edit" ? form.item : undefined}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={toggling !== null}
        onOpenChange={(open) => {
          if (!open && !toggleBusy) setToggling(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggling?.active ? "Deactivate" : "Reactivate"} {toggling?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggling?.active
                ? "It disappears from the proposal builder. Saved versions that use it keep their lines and prices."
                : "Proposal managers can add it to proposals again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {toggleError && (
            <p className="text-sm text-destructive-foreground" role="alert">
              {toggleError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleBusy}>Cancel</AlertDialogCancel>
            <Button
              variant={toggling?.active ? "destructive" : "default"}
              onClick={() => void confirmToggle()}
              disabled={toggleBusy}
            >
              {toggleBusy
                ? "Saving…"
                : toggling?.active
                  ? "Deactivate item"
                  : "Reactivate item"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
