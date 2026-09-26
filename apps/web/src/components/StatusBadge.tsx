import { Badge } from "@/components/ui/badge";
import { formatStatus } from "@/lib/format";

// Amber = waiting on a reviewer, red = blocked on changes; lime stays reserved
// for actions and selection, so settled states are neutral.
const VARIANT_BY_STATUS: Record<
  string,
  "default" | "warning" | "destructive" | "outline"
> = {
  pending: "warning",
  awaiting_approval: "warning",
  changes_requested: "destructive",
  lost: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={VARIANT_BY_STATUS[status] ?? "default"}>
      {formatStatus(status)}
    </Badge>
  );
}
