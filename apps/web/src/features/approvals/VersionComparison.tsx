import type { ProposalVersion } from "../../lib/api";
import { computeLineDiff, type DiffStatus } from "./diff";

interface VersionComparisonProps {
  current: ProposalVersion;
  previous: ProposalVersion | null;
}

const STATUS_BADGES: Record<DiffStatus, { label: string; className: string }> =
  {
    added: {
      label: "Added",
      className: "border border-lime-800 bg-lime-950 text-lime-400",
    },
    removed: {
      label: "Removed",
      className: "border border-red-800 bg-red-950 text-red-400",
    },
    changed: {
      label: "Changed",
      className: "border border-amber-800 bg-amber-950 text-amber-300",
    },
    unchanged: {
      label: "Unchanged",
      className: "bg-navy-800 text-navy-400",
    },
  };

function parseCents(val: string | null | undefined): number {
  if (!val) return 0;
  const num = Number(val);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function VersionComparison({
  current,
  previous,
}: VersionComparisonProps) {
  if (previous === null) {
    return (
      <section
        aria-label="Version comparison"
        className="rounded-md border border-navy-800 bg-navy-900 p-4"
      >
        <h3 className="text-sm font-semibold text-navy-50">
          Version Comparison
        </h3>
        <p className="mt-2 text-sm text-navy-300">
          First version — no previous version to compare.
        </p>
      </section>
    );
  }

  const diffs = computeLineDiff(current, previous);
  const currentCents = parseCents(current.total_estimate);
  const prevCents = parseCents(previous.total_estimate);
  const deltaCents = currentCents - prevCents;
  const deltaAbsFormatted = (Math.abs(deltaCents) / 100).toFixed(2);

  const deltaFormatted =
    deltaCents > 0
      ? `+$${deltaAbsFormatted}`
      : deltaCents < 0
        ? `-$${deltaAbsFormatted}`
        : "$0.00";

  return (
    <section
      aria-label="Version comparison"
      className="rounded-md border border-navy-800 bg-navy-900 p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy-50">
          Comparison with Version {previous.version_number}
        </h3>
        <span className="text-xs text-navy-300">
          Total delta:{" "}
          <span
            className={
              deltaCents > 0
                ? "font-medium text-lime-400"
                : deltaCents < 0
                  ? "font-medium text-red-400"
                  : "font-medium text-navy-300"
            }
          >
            {deltaFormatted}
          </span>
        </span>
      </div>

      {diffs.length === 0 ? (
        <p className="mt-3 text-sm text-navy-400">
          No package lines to compare.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {diffs.map((diff) => {
            const badge = STATUS_BADGES[diff.status];
            const line = diff.currentLine ?? diff.previousLine;
            return (
              <li
                key={diff.id}
                className="flex flex-col gap-1 rounded-md border border-navy-800 bg-navy-950 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-navy-50">{diff.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {line && (
                  <p className="text-xs text-navy-400">
                    qty {line.quantity} · ${line.unit_estimate}/mo · line total
                    ${line.line_total}
                  </p>
                )}

                {diff.changes && diff.changes.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-xs text-amber-300">
                    {diff.changes.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
