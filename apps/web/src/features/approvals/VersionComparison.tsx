import { Badge } from "@/components/ui/badge";
import { CARD_CLASSES } from "@/components/ui/variants";
import { cn } from "@/lib/utils";
import type { ProposalVersion } from "../../lib/api";
import { computeLineDiff, type DiffStatus } from "./diff";

interface VersionComparisonProps {
  current: ProposalVersion;
  previous: ProposalVersion | null;
}

const STATUS_BADGES: Record<
  DiffStatus,
  { label: string; variant: "default" | "destructive" | "warning" | "outline" }
> = {
  added: { label: "Added", variant: "default" },
  removed: { label: "Removed", variant: "destructive" },
  changed: { label: "Changed", variant: "warning" },
  unchanged: { label: "Unchanged", variant: "outline" },
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
        className={cn(CARD_CLASSES, "p-4")}
      >
        <h3 className="text-sm font-semibold text-foreground">
          Version Comparison
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
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
      className={cn(CARD_CLASSES, "p-4")}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Comparison with Version {previous.version_number}
        </h3>
        <span className="text-xs text-muted-foreground">
          Total delta:{" "}
          <span className="font-medium tabular-nums text-foreground">
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
                className="flex flex-col gap-1 rounded-md border border-border bg-navy-950 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {diff.name}
                  </span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>

                {line && (
                  <p className="text-xs text-navy-400">
                    qty {line.quantity} · ${line.unit_estimate}/mo · line total
                    ${line.line_total}
                  </p>
                )}

                {diff.changes && diff.changes.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-xs text-warning-foreground">
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
