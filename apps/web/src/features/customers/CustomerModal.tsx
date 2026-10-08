import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, Pencil, Trash2, XIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/variants";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "../../components/activity-timeline-utils";
import {
  EmptyState,
  ErrorState,
  Skeleton,
} from "../../components/states/StateViews";
import {
  fetchOpportunities,
  type Customer,
  type Opportunity,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";
import { formatMoney } from "../dashboard/charts/chart-theme";

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground tabular-nums">
        {children}
      </dd>
    </div>
  );
}

/**
 * A customer's details and every opportunity with them, in a centred modal. Choosing an
 * opportunity hands it to the page, which opens its side panel on top, so the customer
 * stays one Esc away and nothing navigates.
 */
export function CustomerModal({
  customer,
  editable,
  onClose,
  onOpenOpportunity,
  onEdit,
  onDelete,
  children,
}: {
  customer: Customer | null;
  editable: boolean;
  onClose: () => void;
  onOpenOpportunity: (opportunity: Opportunity) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  /** Layers that open above the modal (the opportunity panel). Rendered inside it so the two nest. */
  children?: ReactNode;
}) {
  const { token, me } = useAuth();
  // Keep the last customer while the panel animates closed.
  const [shown, setShown] = useState(customer);
  if (customer && customer !== shown) setShown(customer);

  const [loaded, setLoaded] = useState<{
    id: number;
    items: Opportunity[];
  } | null>(null);
  const [failure, setFailure] = useState<{
    id: number;
    error: ErrorDescription;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const id = shown?.id ?? null;

  useEffect(() => {
    if (!token || id === null) return;
    let cancelled = false;
    fetchOpportunities(token, id)
      .then((items) => !cancelled && setLoaded({ id, items }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setFailure({
            id,
            error: describeError(err, {
              action: "load this customer's opportunities",
              role: me?.role,
            }),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [token, id, me?.role, attempt]);

  const items = loaded && loaded.id === id ? loaded.items : null;
  const error = failure && failure.id === id ? failure.error : null;

  return (
    <DialogPrimitive.Root
      open={customer !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-overlay fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          data-slot="customer-modal"
          className="modal-content fixed left-1/2 top-1/2 z-50 flex max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none"
        >
          <header className="flex items-start gap-3 border-b border-border px-5 py-4">
            {shown && <Avatar name={shown.name} size="lg" />}
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-lg font-semibold tracking-tight text-foreground">
                {shown?.name ?? "Customer"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                {shown?.industry ?? "No industry set"}
              </DialogPrimitive.Description>
              {shown && (
                <div className="mt-2">
                  <StatusBadge status={shown.status} />
                </div>
              )}
            </div>
            <DialogPrimitive.Close
              className={cn(
                "-mr-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground",
                FOCUS_RING,
              )}
            >
              <XIcon aria-hidden="true" className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {shown && (
              <div className="space-y-5">
                <dl className="grid grid-cols-3 gap-4">
                  <Fact label="Opportunities">
                    {shown.opportunity_count ?? items?.length ?? 0}
                  </Fact>
                  <Fact label="Open">{shown.open_opportunities ?? 0}</Fact>
                  <Fact label="Open pipeline">
                    {formatMoney(Number(shown.open_pipeline_value ?? 0))}/mo
                  </Fact>
                </dl>

                <section aria-label="Opportunities">
                  <h3 className="mb-2 text-sm font-medium text-foreground">
                    Opportunities
                  </h3>
                  {error ? (
                    <ErrorState
                      message={error.message}
                      onRetry={
                        error.retryable
                          ? () => {
                              setFailure(null);
                              setAttempt((n) => n + 1);
                            }
                          : undefined
                      }
                    />
                  ) : items === null ? (
                    <Skeleton className="h-24" />
                  ) : items.length === 0 ? (
                    <EmptyState
                      message="No opportunities with this customer yet."
                      action={
                        editable ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/opportunities">Go to opportunities</Link>
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {items.map((opportunity) => (
                        <li key={opportunity.id}>
                          <button
                            type="button"
                            onClick={() => onOpenOpportunity(opportunity)}
                            className="w-full text-left flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors duration-150 hover:border-navy-700 hover:bg-navy-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {opportunity.title}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {opportunity.last_activity_at
                                  ? `Active ${formatRelativeTime(opportunity.last_activity_at)}`
                                  : "No activity yet"}
                                {opportunity.latest_version &&
                                  ` · ${formatMoney(Number(opportunity.latest_version.total_estimate))}/mo`}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <StatusBadge status={opportunity.status} />
                              <ArrowRight
                                aria-hidden="true"
                                className="size-4 text-muted-foreground"
                              />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </div>
          {editable && shown && (
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => onEdit(shown)}>
                <Pencil aria-hidden="true" />
                Edit customer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive-foreground"
                onClick={() => onDelete(shown)}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            </footer>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
