import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/StatusBadge";
import { formatStatus } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FIELD_CLASSES, Input } from "@/components/ui/input";
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
import type { Customer, Opportunity } from "../../lib/api";

export const PAGE_SIZE = 10;

type SortKey = "title" | "customer" | "status";
type SortDirection = "asc" | "desc";

interface Row {
  opportunity: Opportunity;
  customerName: string;
}

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "title", label: "Opportunity" },
  { key: "customer", label: "Customer", className: "hidden sm:table-cell" },
  { key: "status", label: "Status", className: "w-36" },
];

function sortValue(row: Row, key: SortKey): string {
  if (key === "title") return row.opportunity.title;
  if (key === "customer") return row.customerName;
  return row.opportunity.status;
}

/** Client-side sort, filter and pagination over the already-fetched list. */
export function OpportunitiesTable({
  opportunities,
  customers,
}: {
  opportunities: Opportunity[];
  customers: Customer[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "title",
    direction: "asc",
  });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const customerNameById = new Map(customers.map((c) => [c.id, c.name]));
    return opportunities.map((opportunity) => ({
      opportunity,
      customerName:
        customerNameById.get(opportunity.customer_id) ??
        `Customer #${opportunity.customer_id}`,
    }));
  }, [opportunities, customers]);

  const statuses = useMemo(
    () => [...new Set(opportunities.map((o) => o.status))].sort(),
    [opportunities],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter(
      (row) =>
        (status === "all" || row.opportunity.status === status) &&
        (needle === "" ||
          row.opportunity.title.toLowerCase().includes(needle) ||
          row.customerName.toLowerCase().includes(needle)),
    );
    const factor = sort.direction === "asc" ? 1 : -1;
    return filtered.sort(
      (a, b) =>
        factor *
        sortValue(a, sort.key).localeCompare(
          sortValue(b, sort.key),
          undefined,
          {
            sensitivity: "base",
          },
        ),
    );
  }, [rows, query, status, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  function toggleSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search opportunities"
            placeholder="Search title or customer"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
          className={cn(FIELD_CLASSES, "h-10 sm:w-48")}
        >
          <option value="all">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {formatStatus(value)}
            </option>
          ))}
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map((column) => {
              const isSorted = sort.key === column.key;
              const Icon = !isSorted
                ? ArrowUpDown
                : sort.direction === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <TableHead
                  key={column.key}
                  className={column.className}
                  aria-sort={
                    isSorted
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={cn(
                      "-ml-1 inline-flex items-center gap-1 rounded-sm px-1 uppercase hover:text-foreground",
                      FOCUS_RING,
                      isSorted && "text-foreground",
                    )}
                  >
                    {column.label}
                    <Icon aria-hidden="true" className="size-3" />
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={COLUMNS.length}
                className="py-8 text-center text-muted-foreground"
              >
                No opportunities match these filters.
              </TableCell>
            </TableRow>
          ) : (
            pageRows.map(({ opportunity, customerName }) => (
              <TableRow key={opportunity.id}>
                <TableCell className="min-w-0">
                  <Link
                    to={`/opportunities/${opportunity.id}`}
                    className={cn(
                      "rounded-sm font-medium text-foreground hover:text-primary",
                      FOCUS_RING,
                    )}
                  >
                    {opportunity.title}
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                    {customerName}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {customerName}
                </TableCell>
                <TableCell>
                  <StatusBadge status={opportunity.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {visible.length} of {opportunities.length} opportunities
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
