import { Plus } from "lucide-react";
import { TipBanner } from "../onboarding/TipBanner";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { CompanyLogo } from "@/components/CompanyLogo";
import {
  DataTable,
  type Column,
  type FilterChip,
} from "@/components/data-table/DataTable";
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
import { statusMeta } from "@/lib/status-meta";
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
  type Opportunity,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  ApiError,
  describeError,
  type ErrorDescription,
} from "../../lib/errors";
import { canEditProposals } from "../../lib/roles";
import {
  COMPANY_SIZE_OPTIONS,
  companySizeShort,
  headquarters,
} from "../../lib/customer-profile";
import { formatMoney } from "../dashboard/charts/chart-theme";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { CustomerModal } from "./CustomerModal";
import { OpportunityPanel } from "../opportunities/OpportunityPanel";

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; customer: Customer };

const COLUMNS: Column<Customer>[] = [
  {
    key: "name",
    header: "Customer",
    sortValue: (c) => c.name,
    cell: (c) => (
      <div className="flex min-w-0 items-center gap-3">
        <CompanyLogo name={c.name} />
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{c.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[c.industry ?? "No industry set", headquarters(c)]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortValue: (c) => c.status,
    cell: (c) => <StatusBadge status={c.status} />,
  },
  {
    key: "size",
    header: "Size",
    hideBelow: "lg",
    sortValue: (c) =>
      COMPANY_SIZE_OPTIONS.findIndex((o) => o.value === c.company_size),
    cell: (c) => (
      <span className="text-muted-foreground">
        {companySizeShort(c.company_size) ?? "-"}
      </span>
    ),
  },
  {
    key: "opportunities",
    header: "Opportunities",
    align: "right",
    hideBelow: "sm",
    sortValue: (c) => c.opportunity_count ?? 0,
    cell: (c) => (
      <span>
        {c.opportunity_count ?? 0}
        <span className="ml-1 text-xs text-muted-foreground">
          ({c.open_opportunities ?? 0} open)
        </span>
      </span>
    ),
  },
  {
    key: "pipeline",
    header: "Open pipeline",
    align: "right",
    hideBelow: "md",
    sortValue: (c) => Number(c.open_pipeline_value ?? 0),
    cell: (c) => (
      <span
        className={
          Number(c.open_pipeline_value ?? 0) === 0
            ? "text-muted-foreground"
            : undefined
        }
      >
        {formatMoney(Number(c.open_pipeline_value ?? 0))}/mo
      </span>
    ),
  },
];

const FILTERS: FilterChip<Customer>[] = [
  {
    key: "active",
    label: "Active",
    color: statusMeta("active").color,
    test: (c) => c.status === "active",
  },
  {
    key: "inactive",
    label: "Inactive",
    color: statusMeta("inactive").color,
    test: (c) => c.status === "inactive",
  },
];

export function CustomersPage() {
  const { token, me } = useAuth();
  const editable = !!me && canEditProposals(me.role);

  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // The open customer lives in the URL, so Back closes the panel and a link reopens it.
  const [searchParams, setSearchParams] = useSearchParams();
  const openParam = Number(searchParams.get("open"));
  const openId =
    Number.isInteger(openParam) && openParam > 0 ? openParam : null;
  const openCustomer = customers?.find((c) => c.id === openId) ?? null;
  // An opportunity opened from inside a customer sits on top of it, on this page.
  const oppParam = Number(searchParams.get("opportunity"));
  const openOpportunityId =
    Number.isInteger(oppParam) && oppParam > 0 ? oppParam : null;
  const [oppSeed, setOppSeed] = useState<Opportunity | undefined>(undefined);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchCustomers(token)
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
  }, [token, me?.role, attempt]);

  function reload(): void {
    setAttempt((n) => n + 1);
  }

  function retry(): void {
    setError(null);
    setCustomers(null);
    reload();
  }

  function open(id: number | null): void {
    setSearchParams(id === null ? {} : { open: String(id) });
  }

  function openOpportunity(opportunity: Opportunity | null): void {
    setOppSeed(opportunity ?? undefined);
    const base: Record<string, string> =
      openId === null ? {} : { open: String(openId) };
    setSearchParams(
      opportunity ? { ...base, opportunity: String(opportunity.id) } : base,
    );
  }

  async function handleSubmit(input: CustomerInput): Promise<void> {
    if (!token || form.mode === "closed") return;
    const action =
      form.mode === "create" ? "create this customer" : "save this customer";
    try {
      if (form.mode === "create") {
        const created = await createCustomer(token, input);
        toast.success(`${created.name} created`);
        open(created.id);
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
    if (!token || !pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCustomer(token, pendingDelete.id);
      toast.success(`${pendingDelete.name} deleted`);
      setPendingDelete(null);
      open(null);
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
          message="No customers yet."
          action={
            editable ? (
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
        <div className="mt-6">
          <TipBanner id="customers-panel" className="mb-3">
            Open a customer to see every opportunity with them and jump straight
            to one.
          </TipBanner>
          <DataTable
            label="Customers"
            noun="customers"
            rows={customers}
            columns={COLUMNS}
            rowId={(c) => c.id}
            rowLabel={(c) => c.name}
            onOpen={(c) => open(c.id)}
            selectedId={openId}
            searchText={(c) =>
              `${c.name} ${c.industry ?? ""} ${(c.industry_tags ?? []).join(" ")} ${headquarters(c) ?? ""} ${c.contact_name ?? ""}`
            }
            searchPlaceholder="Search name, industry, city or contact"
            filters={FILTERS}
            initialSort={{ key: "pipeline", direction: "desc" }}
          />
        </div>
      )}

      <CustomerModal
        customer={openCustomer}
        editable={editable}
        onClose={() => open(null)}
        onOpenOpportunity={openOpportunity}
        onEdit={(customer) => setForm({ mode: "edit", customer })}
        onDelete={(customer) => {
          setDeleteError(null);
          setPendingDelete(customer);
        }}
      >
        <OpportunityPanel
          opportunityId={openOpportunityId}
          seed={oppSeed}
          onClose={() => openOpportunity(null)}
          onChanged={reload}
        />
      </CustomerModal>

      {editable && (
        <CustomerFormDialog
          open={form.mode !== "closed"}
          onOpenChange={(isOpen) => {
            if (!isOpen) setForm({ mode: "closed" });
          }}
          customer={form.mode === "edit" ? form.customer : undefined}
          onSubmit={handleSubmit}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !deleting) setPendingDelete(null);
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
