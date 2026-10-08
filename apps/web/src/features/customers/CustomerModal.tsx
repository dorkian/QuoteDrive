import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
  XIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  companySizeShort,
  headquarters,
  safeWebsite,
  websiteDomain,
} from "../../lib/customer-profile";
import { describeError, type ErrorDescription } from "../../lib/errors";
import { formatMoney } from "../dashboard/charts/chart-theme";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-nowrap text-lg font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Globe;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success("Email copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Select the address and copy it by hand.");
    }
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void copy()}
      aria-label={`Copy ${email}`}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * A customer's profile, numbers and opportunities in a centred modal. Choosing an
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
  // Keep the last customer while the modal animates closed.
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
  const sorted = items
    ? [...items].sort(
        (a, b) =>
          Date.parse(b.last_activity_at ?? "") -
          Date.parse(a.last_activity_at ?? ""),
      )
    : null;
  const won = items?.filter((o) => o.status === "won").length ?? 0;
  const lost = items?.filter((o) => o.status === "lost").length ?? 0;

  const website = safeWebsite(shown?.website);
  const place = shown ? headquarters(shown) : null;
  const size = companySizeShort(shown?.company_size);
  const hasDetails = !!website;
  const hasProfile = !!(
    shown &&
    (hasDetails ||
      shown.about ||
      shown.contact_name ||
      shown.industry_tags?.length)
  );

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
          className="modal-content fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl md:h-[min(42rem,calc(100dvh-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none"
        >
          <header className="border-b border-border bg-card/60 px-6 py-5">
            <div className="flex items-start gap-4">
              {shown && <CompanyLogo name={shown.name} size="xl" />}
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="truncate text-xl font-semibold tracking-tight text-foreground">
                  {shown?.name ?? "Customer"}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{shown?.industry ?? "No industry set"}</span>
                  {place && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin aria-hidden="true" className="size-3.5" />
                      {place}
                    </span>
                  )}
                </DialogPrimitive.Description>
                {shown && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={shown.status} />
                    {size && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        <Users aria-hidden="true" className="size-3" />
                        {size}
                      </span>
                    )}
                    {shown.industry_tags?.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-accent px-2 py-0.5 text-xs text-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <DialogPrimitive.Close
                className={cn(
                  "-mr-2 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground",
                  FOCUS_RING,
                )}
              >
                <XIcon aria-hidden="true" className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 md:overflow-hidden">
            {shown && (
              <div className="grid gap-6 md:h-full md:grid-cols-[17rem_minmax(0,1fr)]">
                <aside
                  className="space-y-5 md:min-h-0 md:overflow-y-auto md:pr-2"
                  aria-label="Profile"
                >
                  {shown.about ? (
                    <section>
                      <h3 className="text-sm font-medium text-foreground">
                        About
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {shown.about}
                      </p>
                    </section>
                  ) : null}

                  {hasDetails && (
                    <dl className="space-y-3">
                      {website && (
                        <Detail icon={Globe} label="Website">
                          <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex items-center gap-1 rounded-sm hover:text-primary",
                              FOCUS_RING,
                            )}
                          >
                            {websiteDomain(website)}
                            <ExternalLink
                              aria-hidden="true"
                              className="size-3"
                            />
                            <span className="sr-only">
                              {" "}
                              (opens in a new tab)
                            </span>
                          </a>
                        </Detail>
                      )}
                    </dl>
                  )}

                  {shown.contact_name && (
                    <section
                      aria-label="Primary contact"
                      className="rounded-lg border border-border bg-card p-3"
                    >
                      <h3 className="text-xs text-muted-foreground">
                        Primary contact
                      </h3>
                      <div className="mt-2 flex items-center gap-2.5">
                        <Avatar name={shown.contact_name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {shown.contact_name}
                          </p>
                          {shown.contact_title && (
                            <p className="truncate text-xs text-muted-foreground">
                              {shown.contact_title}
                            </p>
                          )}
                        </div>
                      </div>
                      {shown.contact_email && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild variant="outline" size="sm">
                            <a href={`mailto:${shown.contact_email}`}>
                              <Mail aria-hidden="true" />
                              Email
                            </a>
                          </Button>
                          <CopyEmail email={shown.contact_email} />
                        </div>
                      )}
                    </section>
                  )}

                  {!hasProfile && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      <p>No profile details yet.</p>
                      <p className="mt-1">
                        A short description, location and contact help AI tailor
                        proposals to this customer.
                      </p>
                      {editable && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => onEdit(shown)}
                        >
                          <Plus aria-hidden="true" />
                          Add details
                        </Button>
                      )}
                    </div>
                  )}
                </aside>

                <div className="flex min-w-0 flex-col gap-5 md:min-h-0">
                  <dl className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3">
                    <Stat
                      label="Open pipeline"
                      value={
                        <>
                          {formatMoney(Number(shown.open_pipeline_value ?? 0))}
                          <span className="text-xs font-normal text-muted-foreground">
                            /mo
                          </span>
                        </>
                      }
                    />
                    <Stat
                      label="Opportunities"
                      value={shown.opportunity_count ?? items?.length ?? 0}
                      hint={`${shown.open_opportunities ?? 0} open`}
                    />
                    <Stat label="Won" value={items ? won : "-"} />
                    <Stat
                      label="Win rate"
                      value={
                        items && won + lost > 0
                          ? `${Math.round((won / (won + lost)) * 100)}%`
                          : "-"
                      }
                      hint={
                        items && won + lost === 0
                          ? "No closed deals"
                          : undefined
                      }
                    />
                  </dl>

                  <Tabs
                    defaultValue="opportunities"
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <TabsList className="shrink-0">
                      <TabsTrigger value="opportunities">
                        Opportunities{items ? ` (${items.length})` : ""}
                      </TabsTrigger>
                      <TabsTrigger value="activity">Activity</TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="opportunities"
                      className="mt-4 min-h-0 flex-1 md:overflow-y-auto md:pr-2"
                    >
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
                      ) : sorted === null ? (
                        <Skeleton className="h-24" />
                      ) : sorted.length === 0 ? (
                        <EmptyState
                          message="No opportunities with this customer yet."
                          action={
                            editable ? (
                              <Button asChild size="sm" variant="outline">
                                <Link to="/opportunities">
                                  Go to opportunities
                                </Link>
                              </Button>
                            ) : undefined
                          }
                        />
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {sorted.map((opportunity) => (
                            <li key={opportunity.id}>
                              <button
                                type="button"
                                onClick={() => onOpenOpportunity(opportunity)}
                                className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 text-left transition-colors duration-150 hover:border-navy-700 hover:bg-navy-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
                    </TabsContent>

                    <TabsContent
                      value="activity"
                      className="mt-4 min-h-0 flex-1 md:overflow-y-auto md:pr-2"
                    >
                      <ActivityTimeline
                        entityType="customer"
                        entityId={shown.id}
                        emptyMessage="No changes recorded for this customer yet."
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </div>

          {editable && shown && (
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-3">
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
