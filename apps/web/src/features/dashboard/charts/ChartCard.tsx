import { useState, type ReactNode } from "react";
import { Table2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A titled chart panel. Every chart ships a "Table" view with the same numbers,
 * which is also the accessible fallback for anything a tooltip shows.
 */
export function ChartCard({
  title,
  subtitle,
  table,
  className,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  table?: ReactNode;
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-h-0 flex-col rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            aria-label={`${showTable ? "Show chart" : "Show table"} for ${title}`}
            title={showTable ? "Show chart" : "Show as table"}
            className={cn(
              "-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              showTable && "bg-accent text-foreground",
            )}
          >
            <Table2 className="size-4" aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        {showTable && table ? (
          <div className="absolute inset-0 overflow-auto text-xs">{table}</div>
        ) : (
          children
        )}
      </div>
      {footer && (
        <div className="mt-2 text-xs text-muted-foreground">{footer}</div>
      )}
    </section>
  );
}

export function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full border-collapse text-left tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-muted-foreground">
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={cn("pb-1 pr-2 font-medium", i > 0 && "text-right")}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-t border-border">
            {row.map((cell, c) => (
              <td key={c} className={cn("py-1 pr-2", c > 0 && "text-right")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
