import { useMemo } from "react";

import { Avatar } from "@/components/Avatar";
import {
  DataTable,
  type Column,
  type FilterChip,
} from "@/components/data-table/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { statusMeta } from "@/lib/status-meta";
import { formatRelativeTime } from "../../components/activity-timeline-utils";
import type { Customer, Opportunity } from "../../lib/api";
import { formatMoney } from "../dashboard/charts/chart-theme";

export const PAGE_SIZE = 10;

interface Row {
  opportunity: Opportunity;
  customerName: string;
}

const NEEDS_ATTENTION = new Set(["awaiting_approval", "changes_requested"]);

const stamp = (o: Opportunity): number =>
  Date.parse(o.last_activity_at ?? o.created_at ?? "") || 0;

/** Every opportunity at a glance. Click a row, or its View button, to open the details panel. */
export function OpportunitiesTable({
  opportunities,
  customers,
  selectedId,
  onOpen,
}: {
  opportunities: Opportunity[];
  customers: Customer[];
  selectedId?: number | null;
  onOpen: (opportunity: Opportunity) => void;
}) {
  const rows = useMemo<Row[]>(() => {
    const names = new Map(customers.map((c) => [c.id, c.name]));
    return opportunities.map((opportunity) => ({
      opportunity,
      customerName:
        names.get(opportunity.customer_id) ??
        `Customer #${opportunity.customer_id}`,
    }));
  }, [opportunities, customers]);

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Opportunity",
      sortValue: (r) => r.opportunity.title,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={r.customerName} />
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {r.opportunity.title}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {r.customerName}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.opportunity.status,
      cell: (r) => <StatusBadge status={r.opportunity.status} />,
    },
    {
      key: "proposal",
      header: "Latest proposal",
      hideBelow: "md",
      sortValue: (r) => r.opportunity.latest_version?.status ?? "",
      cell: (r) =>
        r.opportunity.latest_version ? (
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">
              v{r.opportunity.latest_version.version_number}
            </span>
            <StatusBadge status={r.opportunity.latest_version.status} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">None yet</span>
        ),
    },
    {
      key: "value",
      header: "Monthly estimate",
      align: "right",
      hideBelow: "md",
      sortValue: (r) =>
        Number(r.opportunity.latest_version?.total_estimate ?? 0),
      cell: (r) =>
        r.opportunity.latest_version ? (
          formatMoney(Number(r.opportunity.latest_version.total_estimate))
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "owner",
      header: "Owner",
      hideBelow: "lg",
      sortValue: (r) => r.opportunity.owner_name ?? "",
      cell: (r) =>
        r.opportunity.owner_name ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Avatar name={r.opportunity.owner_name} size="sm" />
            {r.opportunity.owner_name}
          </span>
        ) : null,
    },
    {
      key: "activity",
      header: "Last activity",
      hideBelow: "lg",
      sortValue: (r) => stamp(r.opportunity),
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.opportunity.last_activity_at
            ? formatRelativeTime(r.opportunity.last_activity_at)
            : "-"}
        </span>
      ),
    },
  ];

  const filters: FilterChip<Row>[] = [
    {
      key: "open",
      label: "Open",
      color: statusMeta("open").color,
      test: (r) => r.opportunity.status === "open",
    },
    {
      key: "attention",
      label: "Needs attention",
      color: statusMeta("awaiting_approval").color,
      test: (r) =>
        r.opportunity.status === "open" &&
        NEEDS_ATTENTION.has(r.opportunity.latest_version?.status ?? ""),
    },
    {
      key: "won",
      label: "Won",
      color: statusMeta("won").color,
      test: (r) => r.opportunity.status === "won",
    },
    {
      key: "lost",
      label: "Lost",
      color: statusMeta("lost").color,
      test: (r) => r.opportunity.status === "lost",
    },
  ];

  return (
    <div data-tour="opportunities-table" className="mt-3">
      <DataTable
        label="Opportunities"
        noun="opportunities"
        rows={rows}
        columns={columns}
        rowId={(r) => r.opportunity.id}
        rowLabel={(r) => r.opportunity.title}
        onOpen={(r) => onOpen(r.opportunity)}
        selectedId={selectedId}
        searchText={(r) =>
          `${r.opportunity.title} ${r.customerName} ${r.opportunity.owner_name ?? ""}`
        }
        searchPlaceholder="Search title, customer or owner"
        filters={filters}
        initialSort={{ key: "activity", direction: "desc" }}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
