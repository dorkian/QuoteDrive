import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { statusMeta } from "@/lib/status-meta";

/**
 * Tinted pill: coloured icon and label on a faint wash of the status colour.
 * The label is lightened toward white so it stays above 7:1 on the card.
 */
export function StatusBadge({
  status,
  className,
  showHint = true,
}: {
  status: string;
  className?: string;
  showHint?: boolean;
}) {
  const { label, color, icon: Icon, hint } = statusMeta(status);
  return (
    <span
      data-slot="badge"
      data-status={status}
      title={showHint && hint ? hint : undefined}
      style={{ "--tone": color } as CSSProperties}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        "border-[color-mix(in_oklab,var(--tone)_38%,transparent)] bg-[color-mix(in_oklab,var(--tone)_14%,transparent)] text-[color-mix(in_oklab,var(--tone)_60%,white)]",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3 text-[var(--tone)]" />
      {label}
    </span>
  );
}
