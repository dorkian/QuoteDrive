import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
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
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  updateCustomer,
  type Customer,
  type CustomerInput,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  ApiError,
  describeError,
  type ErrorDescription,
} from "../../lib/errors";
import { canEditProposals } from "../../lib/roles";
import { CustomerFormDialog } from "./CustomerFormDialog";

const SEARCH_DEBOUNCE_MS = 250;

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; customer: Customer };

export function CustomersPage() {
  const { token, me } = useAuth();
  const editable = !!me && canEditProposals(me.role);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    fetchCustomers(token, debouncedQuery)
      .then((fetched) => {
        if (!cancelled) {
          setError(null);
          setCustomers(fetched);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            describeError(err, { action: "load customers", role: me?.role }),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, me?.role, debouncedQuery, attempt]);

  function reload(): void {
    setAttempt((n) => n + 1);
  }

  function retry(): void {
    setError(null);
    setCustomers(null);
    reload();
  }

  async function handleSubmit(input: CustomerInput): Promise<void> {
    if (!token || form.mode === "closed") {
      return;
    }
    const action =
      form.mode === "create" ? "create this customer" : "save this customer";
    try {
      if (form.mode === "create") {
        const created = await createCustomer(token, input);
        toast.success(`${created.name} created`);
      } else {
        const updated = await updateCustomer(token, form.customer.id, input);
        toast.success(`${updated.name} saved`);
      }
    } catch (err) {
      throw new Error(
        describeError(err, { action, subject: "customer", role: me?.role })
          .message,
      );
    }
    setForm({ mode: "closed" });
    reload();
  }

  async function handleDelete(): Promise<void> {
    if (!token || !pendingDelete) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCustomer(token, pendingDelete.id);
      toast.success(`${pendingDelete.name} deleted`);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError && err.status === 409
          ? `${pendingDelete.name} still has opportunities, so it can't be deleted. Its opportunities and proposal history stay on record.`
          : describeError(err, {
              action: "delete this customer",
              subject: "customer",
              role: me?.role,
            }).message,
      );
    } finally {
      setDeleting(false);
    }
  }

  const isSearching = debouncedQuery !== "";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Customers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The organizations you prepare proposals for.
          </p>
        </div>
        {editable && (
          <Button onClick={() => setForm({ mode: "create" })}>
            <Plus aria-hidden="true" className="size-4" />
            New customer
          </Button>
        )}
      </div>

      <div className="relative mt-6 sm:max-w-xs">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search customers"
          placeholder="Search by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      ) : customers === null ? (
        <LoadingRegion label="Customers loading" className="mt-4">
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </LoadingRegion>
      ) : customers.length === 0 ? (
        <EmptyState
          className="mt-4"
          message={
            isSearching
              ? `No customers match “${debouncedQuery}”.`
              : "No customers yet."
          }
          action={
            editable && !isSearching ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setForm({ mode: "create" })}
              >
                Add your first customer
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table className="mt-4">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Customer</TableHead>
              <TableHead className="hidden sm:table-cell">Industry</TableHead>
              <TableHead className="w-28">Status</TableHead>
              {editable && (
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium text-foreground">
                  {customer.name}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {customer.industry ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={customer.status} />
                </TableCell>
                {editable && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${customer.name}`}
                        onClick={() => setForm({ mode: "edit", customer })}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${customer.name}`}
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDelete(customer);
                        }}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editable && (
        <CustomerFormDialog
          open={form.mode !== "closed"}
          onOpenChange={(open) => {
            if (!open) setForm({ mode: "closed" });
          }}
          customer={form.mode === "edit" ? form.customer : undefined}
          onSubmit={handleSubmit}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the customer permanently. Customers with
              opportunities can&apos;t be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive-foreground" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting || deleteError !== null}
            >
              {deleting ? "Deleting…" : "Delete customer"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
