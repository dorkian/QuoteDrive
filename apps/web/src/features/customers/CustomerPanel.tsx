import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { EntityPanel } from "@/components/EntityPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
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

/** A customer's details and every opportunity with them, without leaving the list. */
export function CustomerPanel({
  customer,
  editable,
  onClose,
  onEdit,
  onDelete,
}: {
  customer: Customer | null;
  editable: boolean;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
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
    <EntityPanel
      open={customer !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={shown?.name ?? "Customer"}
      description={shown?.industry ?? "No industry set"}
      avatar={shown && <Avatar name={shown.name} size="lg" />}
      badge={shown && <StatusBadge status={shown.status} />}
      footer={
        editable && shown ? (
          <>
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
          </>
        ) : undefined
      }
    >
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
                    <Link
                      to={`/opportunities?open=${opportunity.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors duration-150 hover:border-navy-700 hover:bg-navy-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </EntityPanel>
  );
}
