import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  calculateEstimate,
  fetchCatalogueItems,
  fetchProposalVersion,
  finalizeProposalVersion,
  updateProposalVersion,
  type CatalogueItem,
  type EstimateCalculateResponse,
  type ProposalVersion,
  type ProposalVersionLineInput,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { ActivityTimeline } from "../../components/ActivityTimeline";
import { AiNarrativeEditor } from "./AiNarrativeEditor";

const ESTIMATE_DEBOUNCE_MS = 400;

function canEdit(role: string): boolean {
  return role === "admin" || role === "proposal_manager";
}

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

  const [version, setVersion] = useState<ProposalVersion | null>(null);
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[] | null>(
    null,
  );
  const [lines, setLines] = useState<ProposalVersionLineInput[]>([]);
  const [liveEstimate, setLiveEstimate] =
    useState<EstimateCalculateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    null,
  );

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!token || Number.isNaN(id)) {
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
      .catch(() =>
        setError("Couldn't load this proposal version. Try refreshing."),
      );
  }, [token, id]);

  const editable =
    !!version && !!me && canEdit(me.role) && isVersionEditable(version.status);

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
        .catch(() => {
          if (requestId === requestIdRef.current) {
            setError("Couldn't recalculate the estimate.");
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
    } catch {
      setError("Couldn't save the proposal version.");
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
    } catch {
      setError("Couldn't finalize the proposal version.");
    } finally {
      setFinalizing(false);
    }
  }

  if (error && !version) {
    return (
      <p className="text-sm text-red-400" role="alert">
        {error}
      </p>
    );
  }

  if (!version || !catalogueItems) {
    return (
      <div
        className="h-32 animate-pulse rounded-md border border-navy-800 bg-navy-900"
        role="status"
        aria-label="Proposal builder loading"
      />
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
        className="text-xs text-navy-300 hover:text-lime-400"
      >
        ← Back to opportunity
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-navy-50">
          Version {version.version_number}
        </h1>
        <span className="rounded-full bg-navy-800 px-3 py-1 text-xs font-medium text-navy-50">
          {version.status}
        </span>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {editable ? (
        <>
          <div className="mt-6 flex items-center gap-2">
            <select
              value={selectedPackageId ?? ""}
              onChange={(e) => setSelectedPackageId(Number(e.target.value))}
              disabled={packages.length === 0}
              className="rounded-md border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-navy-50"
            >
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} · ${pkg.base_monthly_estimate}/mo
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addLine}
              disabled={packages.length === 0}
              className="rounded-md border border-navy-700 px-3 py-2 text-sm font-medium text-navy-50 transition-colors duration-150 hover:border-lime-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add package line
            </button>
          </div>

          {displayLines.length === 0 ? (
            <p className="mt-4 text-sm text-navy-300">
              No package lines yet. Add one above.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {displayLines.map(({ input, live, catalogue }, index) => (
                <li
                  key={index}
                  className="rounded-md border border-navy-800 bg-navy-900 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-navy-50">
                        {catalogue?.name ?? live?.name ?? "Package"}
                      </p>
                      <p className="text-xs text-navy-300">
                        {live
                          ? `$${live.unit_estimate}/mo · line total $${live.line_total}`
                          : "Calculating…"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveLine(index, -1)}
                        disabled={index === 0}
                        aria-label="Move line up"
                        className="rounded px-2 py-1 text-navy-300 hover:text-lime-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLine(index, 1)}
                        disabled={index === displayLines.length - 1}
                        aria-label="Move line down"
                        className="rounded px-2 py-1 text-navy-300 hover:text-lime-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        aria-label="Remove line"
                        className="rounded px-2 py-1 text-navy-300 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <label className="flex flex-col gap-1 text-xs text-navy-300">
                      Quantity
                      <input
                        type="number"
                        min={0}
                        value={input.quantity}
                        onChange={(e) =>
                          updateLine(index, {
                            quantity: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-20 rounded-md border border-navy-700 bg-navy-950 px-2 py-1 text-sm text-navy-50"
                      />
                    </label>

                    <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-navy-300">
                      Assumptions
                      <input
                        type="text"
                        value={input.assumptions ?? ""}
                        onChange={(e) =>
                          updateLine(index, {
                            assumptions: e.target.value || null,
                          })
                        }
                        placeholder="e.g. 12-month term, standard mileage"
                        className="rounded-md border border-navy-700 bg-navy-950 px-2 py-1 text-sm text-navy-50"
                      />
                    </label>
                  </div>

                  {addOns.length > 0 && (
                    <fieldset className="mt-3">
                      <legend className="text-xs text-navy-300">Add-ons</legend>
                      <div className="mt-1 flex flex-wrap gap-3">
                        {addOns.map((addOn) => (
                          <label
                            key={addOn.id}
                            className="flex items-center gap-1.5 text-xs text-navy-50"
                          >
                            <input
                              type="checkbox"
                              checked={input.add_on_item_ids.includes(addOn.id)}
                              onChange={() => toggleAddOn(index, addOn.id)}
                              className="accent-lime-400"
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

          <div className="mt-6 flex items-center justify-between border-t border-navy-800 pt-4">
            <div>
              <p className="text-sm font-medium text-navy-50">
                Total: ${liveEstimate?.total_estimate ?? version.total_estimate}
              </p>
              <p className="text-xs text-navy-400">
                {liveEstimate?.disclaimer ??
                  "Illustrative planning estimate only."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-md border border-navy-700 px-4 py-2 text-sm font-medium text-navy-50 transition-colors duration-150 hover:border-lime-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => void handleFinalize()}
                disabled={finalizing || lines.length === 0}
                className="rounded-md bg-lime-400 px-4 py-2 text-sm font-medium text-navy-950 transition-colors duration-150 hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {finalizing ? "Finalizing…" : "Finalize"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6">
          {version.content_json.lines.length === 0 ? (
            <p className="text-sm text-navy-300">No package lines.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {version.content_json.lines.map((line, index) => (
                <li
                  key={index}
                  className="rounded-md border border-navy-800 bg-navy-900 p-4"
                >
                  <p className="text-sm font-medium text-navy-50">
                    {line.name} · qty {line.quantity}
                  </p>
                  <p className="text-xs text-navy-300">
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
          <div className="mt-6 border-t border-navy-800 pt-4">
            <p className="text-sm font-medium text-navy-50">
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

      <section className="mt-10 border-t border-navy-800 pt-6">
        <h2 className="mb-4 text-sm font-medium text-navy-50">Activity</h2>
        <ActivityTimeline
          entityType="proposal_version"
          entityId={version.id}
          emptyMessage="No activity on this proposal version yet."
        />
      </section>
    </div>
  );
}

