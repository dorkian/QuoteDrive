import { Plus } from "lucide-react";
import { TipBanner } from "../onboarding/TipBanner";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { OpportunitiesTable } from "./OpportunitiesTable";
import { OpportunityPanel } from "./OpportunityPanel";
import {
  OpportunityFormDialog,
  type OpportunityFormValues,
} from "./OpportunityFormDialog";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import {
  createOpportunity,
  fetchCustomers,
  fetchOpportunities,
  type Customer,
  type Opportunity,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";
import { canEditProposals } from "../../lib/roles";

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Opportunities loading">
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </LoadingRegion>
  );
}

export function OpportunitiesListPage() {
  const { token, me } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(
    null,
  );
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  // The open record lives in the URL, so Back closes the panel and a link reopens it.
  const [searchParams, setSearchParams] = useSearchParams();
  const openParam = Number(searchParams.get("open"));
  const openId =
    Number.isInteger(openParam) && openParam > 0 ? openParam : null;
  const editable = !!me && canEditProposals(me.role);

  useEffect(() => {
    if (!token) {
      return;
    }
    Promise.all([fetchOpportunities(token), fetchCustomers(token)])
      .then(([fetchedOpportunities, fetchedCustomers]) => {
        setOpportunities(fetchedOpportunities);
        setCustomers(fetchedCustomers);
      })
      .catch((err: unknown) =>
        setError(
          describeError(err, {
            action: "load opportunities",
            role: me?.role,
          }),
        ),
      );
  }, [token, me?.role, attempt]);

  function retry(): void {
    setError(null);
    setOpportunities(null);
    setCustomers(null);
    setAttempt((n) => n + 1);
  }

  async function handleCreate(values: OpportunityFormValues): Promise<void> {
    if (!token) {
      return;
    }
    let created: Opportunity;
    try {
      created = await createOpportunity(token, {
        customer_id: values.customer_id,
        title: values.title,
      });
    } catch (err) {
      throw new Error(
        describeError(err, {
          action: "create this opportunity",
          subject: "customer",
          role: me?.role,
        }).message,
      );
    }
    toast.success(`${created.title} created`);
    setOpportunities((prev) => (prev ? [created, ...prev] : [created]));
    setSearchParams({ open: String(created.id) });
  }

  function openOpportunity(id: number | null): void {
    if (id === null) setSearchParams({});
    else setSearchParams({ open: String(id) });
  }

  function replaceOpportunity(updated: Opportunity): void {
    setOpportunities(
      (prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? prev,
    );
  }

  const isLoading = opportunities === null || customers === null;
  const hasCustomers = !!customers && customers.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Opportunities
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every opportunity in your organization.
          </p>
        </div>
        {editable && hasCustomers && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" />
            New opportunity
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : opportunities.length === 0 ? (
        <EmptyState
          message={
            editable && !hasCustomers
              ? "No opportunities yet. Add a customer first, then create an opportunity for them."
              : "No opportunities yet."
          }
          action={
            editable && !hasCustomers ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/customers")}
              >
                Go to customers
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <TipBanner id="opportunities-row" className="mt-6">
            Click any row, or its View button, to open the opportunity in a side
            panel. You keep your place in the list.
          </TipBanner>
          <OpportunitiesTable
            opportunities={opportunities}
            customers={customers}
            selectedId={openId}
            onOpen={(opportunity) => openOpportunity(opportunity.id)}
          />
        </>
      )}

      <OpportunityPanel
        opportunityId={openId}
        seed={opportunities?.find((o) => o.id === openId)}
        onClose={() => openOpportunity(null)}
        onChanged={replaceOpportunity}
      />

      {editable && customers && (
        <OpportunityFormDialog
          mode="create"
          customers={customers}
          open={creating}
          onOpenChange={setCreating}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
