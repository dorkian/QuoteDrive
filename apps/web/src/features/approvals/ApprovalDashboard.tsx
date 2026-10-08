import { useEffect, useState } from "react";
import { TipBanner } from "../onboarding/TipBanner";
import { Hourglass } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import {
  DataTable,
  type Column,
  type FilterChip,
} from "@/components/data-table/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { statusMeta } from "@/lib/status-meta";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import {
  canDecideApproval,
  fetchApprovalRequests,
  type ApprovalRequest,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";

const HOUR = 3_600_000;
const URGENT_AFTER_HOURS = 48;

function waitingHours(request: ApprovalRequest): number {
  return Math.max(0, (Date.now() - Date.parse(request.created_at)) / HOUR);
}

function formatWaiting(hours: number): string {
  if (hours < 1) return "Under an hour";
  if (hours < 48) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} days`;
}

function Person({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <Avatar name={name} size="sm" />
      {name}
    </span>
  );
}

const COLUMNS: Column<ApprovalRequest>[] = [
  {
    key: "proposal",
    header: "Proposal",
    sortValue: (r) => r.opportunity_title,
    cell: (r) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">
          {r.opportunity_title}
        </div>
        <div className="text-xs text-muted-foreground">
          Version {r.version_number}
        </div>
      </div>
    ),
  },
  {
    key: "from",
    header: "Submitted by",
    hideBelow: "md",
    sortValue: (r) => r.requested_by_name,
    cell: (r) => <Person name={r.requested_by_name} />,
  },
  {
    key: "to",
    header: "Assigned to",
    hideBelow: "lg",
    sortValue: (r) => r.assigned_to_name,
    cell: (r) => <Person name={r.assigned_to_name} />,
  },
  {
    key: "waiting",
    header: "Waiting",
    sortValue: (r) => waitingHours(r),
    cell: (r) => {
      const hours = waitingHours(r);
      const urgent = hours >= URGENT_AFTER_HOURS;
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-sm",
            urgent
              ? "font-medium text-[color-mix(in_oklab,#ec835a_60%,white)]"
              : "text-muted-foreground",
          )}
          title={`Submitted ${new Date(r.created_at).toLocaleString()}`}
        >
          {urgent && (
            <Hourglass aria-hidden="true" className="size-3.5 text-[#ec835a]" />
          )}
          {formatWaiting(hours)}
          {urgent && <span className="sr-only"> (overdue)</span>}
        </span>
      );
    },
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
];

const FILTERS: FilterChip<ApprovalRequest>[] = [
  {
    key: "overdue",
    label: "Waiting 2+ days",
    color: statusMeta("changes_requested").color,
    test: (r) => waitingHours(r) >= URGENT_AFTER_HOURS,
  },
];

function PageHeading() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Pending approvals
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review and decide on submitted proposal versions.
      </p>
    </>
  );
}

export function ApprovalDashboard() {
  const { token, me } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();

  const isAllowed = me ? canDecideApproval(me.role) : false;

  useEffect(() => {
    if (!token || !isAllowed) {
      return;
    }
    fetchApprovalRequests(token, "pending")
      .then(setRequests)
      .catch((err: unknown) =>
        setError(
          describeError(err, {
            action: "load pending approvals",
            role: me?.role,
          }),
        ),
      );
  }, [token, isAllowed, me?.role, attempt]);

  function retry(): void {
    setError(null);
    setRequests(null);
    setAttempt((n) => n + 1);
  }

  if (me && !isAllowed) {
    return (
      <div>
        <PageHeading />
        <ForbiddenState
          role={me.role}
          what="review approval requests"
          allowed="Approvers and Admins"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeading />

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      ) : requests === null ? (
        <LoadingRegion label="Approvals loading">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </LoadingRegion>
      ) : (
        <div data-tour="approvals-table" className="mt-6">
          <TipBanner id="approvals-waiting" className="mb-3">
            Waiting time turns orange after two days, so slow approvals are easy
            to spot.
          </TipBanner>
          <DataTable
            label="Pending approvals"
            noun="approvals"
            rows={requests}
            columns={COLUMNS}
            rowId={(r) => r.id}
            rowLabel={(r) =>
              `${r.opportunity_title} version ${r.version_number}`
            }
            onOpen={(r) => navigate(`/approvals/${r.id}`)}
            searchText={(r) =>
              `${r.opportunity_title} ${r.requested_by_name} ${r.assigned_to_name}`
            }
            searchPlaceholder="Search proposal or person"
            filters={FILTERS}
            initialSort={{ key: "waiting", direction: "desc" }}
            empty={
              <EmptyState
                className=""
                message="No pending approvals. New requests appear here the moment a manager submits one."
              />
            }
          />
        </div>
      )}
    </div>
  );
}
