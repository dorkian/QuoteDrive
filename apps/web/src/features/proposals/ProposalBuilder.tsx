import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { StatusBadge } from "@/components/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FIELD_CLASSES, Input } from "@/components/ui/input";
import { CARD_CLASSES } from "@/components/ui/variants";
import { cn } from "@/lib/utils";

import {
  calculateEstimate,
  fetchCatalogueItems,
  fetchProposalVersion,
  finalizeProposalVersion,
  isPreviewableStatus,
  updateProposalVersion,
  type CatalogueItem,
  type EstimateCalculateResponse,
  type ProposalVersion,
  type ProposalVersionLineInput,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";
import { canEditProposals } from "../../lib/roles";
import { ActivityTimeline } from "../../components/ActivityTimeline";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import { AiNarrativeEditor } from "./AiNarrativeEditor";
import { SubmitForApproval } from "./SubmitForApproval";
import { VersionLifecycleActions } from "./VersionLifecycleActions";

const ESTIMATE_DEBOUNCE_MS = 400;

const NOT_FOUND: ErrorDescription = {
  message: "This proposal version doesn't exist or isn't in your organization.",
  retryable: false,
};

function isVersionEditable(status: string): boolean {
  return status === "draft" || status === "configured";
}

function toLineInput(
  line: ProposalVersion["content_json"]["lines"][number],
): ProposalVersionLineInput {
  return {
    catalogue_item_id: line.catalogue_item_id,
    quantity: line.quantity,
    add_on_item_ids: line.add_on_item_ids ?? [],
    assumptions: line.assumptions ?? null,
  };
}

export function ProposalBuilder() {
  const { token, me } = useAuth();
  const { versionId } = useParams<{ versionId: string }>();
  const id = Number(versionId);
  const isInvalidId = !Number.isInteger(id) || id <= 0;

  const [version, setVersion] = useState<ProposalVersion | null>(null);
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[] | null>(
    null,
  );
  const [lines, setLines] = useState<ProposalVersionLineInput[]>([]);
  const [liveEstimate, setLiveEstimate] =
    useState<EstimateCalculateResponse | null>(null);
  const [loadError, setLoadError] = useState<ErrorDescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    null,
  );

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!token || isInvalidId) {
      return;
    }
    Promise.all([fetchProposalVersion(token, id), fetchCatalogueItems(token)])
      .then(([fetchedVersion, fetchedItems]) => {
        setVersion(fetchedVersion);
        setCatalogueItems(fetchedItems);
        setLines(fetchedVersion.content_json.lines.map(toLineInput));
        const firstPackage = fetchedItems.find(
          (item) => item.type === "package",
        );
        setSelectedPackageId(firstPackage?.id ?? null);
      })
      .catch((err: unknown) =>
        setLoadError(
          describeError(err, {
            action: "load this proposal version",
            subject: "proposal version",
            role: me?.role,
          }),
        ),
      );
  }, [token, id, isInvalidId, me?.role, attempt]);

  function retry(): void {
    setLoadError(null);
    setVersion(null);
    setCatalogueItems(null);
    setAttempt((n) => n + 1);
  }

  function describeActionError(err: unknown, action: string): string {
    return describeError(err, { action, role: me?.role }).message;
  }

  const editable =
    !!version &&
    !!me &&
    canEditProposals(me.role) &&
    isVersionEditable(version.status);

  useEffect(() => {
    if (!token || !editable || lines.length === 0) {
      setLiveEstimate(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      calculateEstimate(
        token,
        lines.map(({ catalogue_item_id, quantity, add_on_item_ids }) => ({
          catalogue_item_id,
          quantity,
          add_on_item_ids,
        })),
      )
        .then((result) => {
          if (requestId === requestIdRef.current) {
            setLiveEstimate(result);
          }
        })
        .catch((err: unknown) => {
          if (requestId === requestIdRef.current) {
            setError(describeActionError(err, "recalculate the estimate"));
          }
        });
    }, ESTIMATE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, editable, JSON.stringify(lines)]);

  function addLine(): void {
    if (selectedPackageId === null) {
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        catalogue_item_id: selectedPackageId,
        quantity: 1,
        add_on_item_ids: [],
        assumptions: null,
      },
    ]);
  }

  function removeLine(index: number): void {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function moveLine(index: number, direction: -1 | 1): void {
    setLines((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateLine(
    index: number,
    patch: Partial<ProposalVersionLineInput>,
  ): void {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function toggleAddOn(index: number, addOnId: number): void {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) {
          return line;
        }
        const has = line.add_on_item_ids.includes(addOnId);
        return {
          ...line,
          add_on_item_ids: has
            ? line.add_on_item_ids.filter((id) => id !== addOnId)
            : [...line.add_on_item_ids, addOnId],
        };
      }),
    );
  }

  async function handleSave(): Promise<void> {
    if (!token || !version) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateProposalVersion(token, version.id, lines);
      setVersion(saved);
      setLines(saved.content_json.lines.map(toLineInput));
      toast.success("Proposal version saved");
    } catch (err) {
      const message = describeActionError(err, "save this proposal version");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize(): Promise<void> {
    if (!token || !version) {
      return;
    }
    setFinalizing(true);
    setError(null);
    try {
      await updateProposalVersion(token, version.id, lines);
      const finalized = await finalizeProposalVersion(token, version.id);
      setVersion(finalized);
      toast.success(`Version ${finalized.version_number} finalized`);
    } catch (err) {
      const message = describeActionError(
        err,
        "finalize this proposal version",
      );
      setError(message);
      toast.error(message);
    } finally {
      setFinalizing(false);
    }
  }

  const blockingError = isInvalidId ? NOT_FOUND : loadError;
  if (blockingError) {
    return (
      <ErrorState
        className=""
        message={blockingError.message}
        onRetry={blockingError.retryable ? retry : undefined}
      />
    );
  }

  if (!version || !catalogueItems) {
    return (
      <LoadingRegion label="Proposal builder loading" className="">
        <Skeleton className="h-32" />
      </LoadingRegion>
    );
  }

  const packages = catalogueItems.filter((item) => item.type === "package");
  const addOns = catalogueItems.filter((item) => item.type === "add_on");
  const displayLines = editable
    ? lines.map((line, index) => ({
        input: line,
        live: liveEstimate?.lines[index],
        catalogue: catalogueItems.find(
          (item) => item.id === line.catalogue_item_id,
        ),
      }))
    : [];

  return (
    <div>
      <Link
        to={`/opportunities/${version.opportunity_id}`}
        className="-my-2 inline-flex min-h-10 items-center rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        ← Back to opportunity
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Version {version.version_number}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          {isPreviewableStatus(version.status) && (
            <Button asChild variant="link" size="sm">
              <Link to={`/proposal-versions/${version.id}/preview`}>
                Client preview →
              </Link>
            </Button>
          )}
          <StatusBadge status={version.status} />
          {token && me && canEditProposals(me.role) && (
            <SubmitForApproval
              token={token}
              role={me.role}
              version={version}
              onChanged={setVersion}
            />
          )}
          {token && me && canEditProposals(me.role) && (
            <VersionLifecycleActions
              token={token}
              role={me.role}
              version={version}
              onChanged={setVersion}
            />
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive-foreground" role="alert">
          {error}
        </p>
      )}

      {editable ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <select
              value={selectedPackageId ?? ""}
              onChange={(e) => setSelectedPackageId(Number(e.target.value))}
              disabled={packages.length === 0}
              aria-label="Package to add"
              className={cn(FIELD_CLASSES, "h-10 w-auto max-w-full")}
            >
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} · ${pkg.base_monthly_estimate}/mo
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={addLine}
              disabled={packages.length === 0}
            >
              Add package line
            </Button>
          </div>

          {displayLines.length === 0 ? (
            <EmptyState
              className="mt-4"
              message="No package lines yet. Add one above."
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {displayLines.map(({ input, live, catalogue }, index) => (
                <li key={index} className={cn(CARD_CLASSES, "p-4")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {catalogue?.name ?? live?.name ?? "Package"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {live
                          ? `$${live.unit_estimate}/mo · line total $${live.line_total}`
                          : "Calculating…"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveLine(index, -1)}
                        disabled={index === 0}
                        aria-label="Move line up"
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveLine(index, 1)}
                        disabled={index === displayLines.length - 1}
                        aria-label="Move line down"
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => removeLine(index)}
                        aria-label="Remove line"
                        className="px-2 hover:text-destructive-foreground"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Quantity
                      <Input
                        type="number"
                        min={0}
                        value={input.quantity}
                        onChange={(e) =>
                          updateLine(index, {
                            quantity: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-20"
                      />
                    </label>

                    <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                      Assumptions
                      <Input
                        type="text"
                        value={input.assumptions ?? ""}
                        onChange={(e) =>
                          updateLine(index, {
                            assumptions: e.target.value || null,
                          })
                        }
                        placeholder="e.g. 12-month term, standard mileage"
                      />
                    </label>
                  </div>

                  {addOns.length > 0 && (
                    <fieldset className="mt-3">
                      <legend className="text-xs text-muted-foreground">
                        Add-ons
                      </legend>
                      <div className="mt-1 flex flex-wrap gap-3">
                        {addOns.map((addOn) => (
                          <label
                            key={addOn.id}
                            className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-foreground"
                          >
                            <input
                              type="checkbox"
                              checked={input.add_on_item_ids.includes(addOn.id)}
                              onChange={() => toggleAddOn(index, addOn.id)}
                              className="size-4 accent-lime-400"
                            />
                            {addOn.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Total: ${liveEstimate?.total_estimate ?? version.total_estimate}
              </p>
              <p className="text-xs text-navy-400">
                {liveEstimate?.disclaimer ??
                  "Illustrative planning estimate only."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={finalizing || lines.length === 0}>
                    {finalizing ? "Finalizing…" : "Finalize"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Finalize version {version.version_number}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Pending changes are saved first. After finalizing, the
                      package lines are locked and can&apos;t be edited in this
                      version.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleFinalize()}>
                      Finalize version
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6">
          {version.content_json.lines.length === 0 ? (
            <EmptyState className="" message="No package lines." />
          ) : (
            <ul className="flex flex-col gap-3">
              {version.content_json.lines.map((line, index) => (
                <li key={index} className={cn(CARD_CLASSES, "p-4")}>
                  <p className="text-sm font-medium text-foreground">
                    {line.name} · qty {line.quantity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${line.unit_estimate}/mo · line total ${line.line_total}
                  </p>
                  {line.assumptions && (
                    <p className="mt-1 text-xs text-navy-400">
                      {line.assumptions}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">
              Total: ${version.total_estimate}
            </p>
            <p className="text-xs text-navy-400">
              Illustrative planning estimate only.
            </p>
          </div>
        </div>
      )}

      <AiNarrativeEditor
        version={version}
        editable={editable}
        token={token!}
        onSaved={setVersion}
      />

      <section className="mt-10 border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-medium text-foreground">Activity</h2>
        <ActivityTimeline
          entityType="proposal_version"
          entityId={version.id}
          emptyMessage="No activity on this proposal version yet."
        />
      </section>
    </div>
  );
}
