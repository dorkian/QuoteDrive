import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/states/StateViews";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FOCUS_RING } from "@/components/ui/variants";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "right";
  className?: string;
  /** Hide this column below a breakpoint; the same facts live in the detail panel. */
  hideBelow?: "sm" | "md" | "lg";
}

export interface FilterChip<T> {
  key: string;
  label: string;
  test: (row: T) => boolean;
  /** A dot of this colour marks the chip, matching the status colours. */
  color?: string;
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * One table for every list. Click anywhere on a row, or its View button, to open
 * the record. Keyboard and screen-reader users get the View button as the single
 * stop per row.
 */
export function DataTable<T>({
  label,
  rows,
  columns,
  rowId,
  rowLabel,
  onOpen,
  selectedId,
  searchText,
  searchPlaceholder = "Search",
  filters,
  initialSort,
  pageSize = 10,
  loading = false,
  empty,
  noun = "items",
  toolbarExtra,
}: {
  label: string;
  rows: T[];
  columns: Column<T>[];
  rowId: (row: T) => string | number;
  rowLabel: (row: T) => string;
  onOpen: (row: T) => void;
  selectedId?: string | number | null;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: FilterChip<T>[];
  initialSort?: { key: string; direction: "asc" | "desc" };
  pageSize?: number;
  loading?: boolean;
  empty?: ReactNode;
  noun?: string;
  toolbarExtra?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const counts = useMemo(
    () =>
      new Map((filters ?? []).map((f) => [f.key, rows.filter(f.test).length])),
    [filters, rows],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const active = filters?.find((f) => f.key === filter);
    const filtered = rows.filter(
      (row) =>
        (!active || active.test(row)) &&
        (needle === "" ||
          (searchText?.(row) ?? "").toLowerCase().includes(needle)),
    );
    const column = columns.find((c) => c.key === sort?.key);
    if (!column?.sortValue || !sort) return filtered;
    const get = column.sortValue;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return (
        factor *
        (typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), undefined, {
              sensitivity: "base",
            }))
      );
    });
  }, [rows, query, filter, filters, sort, columns, searchText]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const shown = visible.slice(current * pageSize, (current + 1) * pageSize);
  const from = visible.length === 0 ? 0 : current * pageSize + 1;

  function toggleSort(key: string): void {
    setSort((s) => ({
      key,
      direction: s?.key === key && s.direction === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      {(searchText || filters || toolbarExtra) && (
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            {searchText && (
              <div className="relative sm:w-72">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  aria-label={`Search ${noun}`}
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                />
              </div>
            )}
            {filters && (
              <div
                role="group"
                aria-label={`Filter ${noun}`}
                className="flex flex-wrap gap-1.5"
              >
                {[
                  {
                    key: "all",
                    label: "All",
                    color: undefined,
                    count: rows.length,
                  },
                  ...filters.map((f) => ({
                    ...f,
                    count: counts.get(f.key) ?? 0,
                  })),
                ].map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    aria-pressed={filter === chip.key}
                    onClick={() => {
                      setFilter(chip.key);
                      setPage(0);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-150",
                      FOCUS_RING,
                      filter === chip.key
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {chip.color && (
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ background: chip.color }}
                      />
                    )}
                    {chip.label}
                    <span className="tabular-nums text-muted-foreground">
                      {chip.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {toolbarExtra}
        </div>
      )}

      <Table aria-label={label}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const isSorted = sort?.key === column.key;
              const Icon = !isSorted
                ? ArrowUpDown
                : sort.direction === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <TableHead
                  key={column.key}
                  aria-sort={
                    isSorted
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={cn(
                    column.align === "right" && "text-right",
                    column.hideBelow && HIDE[column.hideBelow],
                    column.className,
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 uppercase hover:text-foreground",
                        FOCUS_RING,
                        isSorted && "text-foreground",
                      )}
                    >
                      {column.header}
                      <Icon aria-hidden="true" className="size-3" />
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
            <TableHead className="w-24">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={columns.length + 1}>
                  <Skeleton className="h-9 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : shown.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length + 1}
                className="py-10 text-center text-muted-foreground"
              >
                {rows.length === 0 && empty
                  ? empty
                  : `No ${noun} match these filters.`}
              </TableCell>
            </TableRow>
          ) : (
            shown.map((row) => {
              const id = rowId(row);
              return (
                <TableRow
                  key={id}
                  data-selected={selectedId === id || undefined}
                  onClick={() => onOpen(row)}
                  className="group cursor-pointer data-[selected]:bg-accent/70 hover:bg-accent/50"
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        column.align === "right" && "text-right tabular-nums",
                        column.hideBelow && HIDE[column.hideBelow],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`View ${rowLabel(row)}`}
                      className="gap-0.5 text-muted-foreground group-hover:text-foreground"
                    >
                      View
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {visible.length === 0
            ? `0 ${noun}`
            : `Showing ${from}–${from + shown.length - 1} of ${visible.length} ${noun}`}
          {visible.length !== rows.length && ` (${rows.length} total)`}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <span>
              Page {current + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(current + 1)}
              disabled={current >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
