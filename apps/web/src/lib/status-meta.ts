import {
  BadgeCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  Hourglass,
  PenLine,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { formatStatus } from "./format";

/**
 * One source of truth for how every status looks, so a status reads the same in
 * tables, panels, charts and the dashboard. Colour is never the only signal:
 * each status also has an icon and a label. Lime stays reserved for actions.
 */
export interface StatusMeta {
  label: string;
  color: string;
  icon: LucideIcon;
  /** Plain-language hint, shown as a tooltip. */
  hint: string;
}

const SLATE = "#8da2c0";
const VIOLET = "#9085e9";
const AMBER = "#fab219";
const ORANGE = "#ec835a";
const TEAL = "#199e70";
const BLUE = "#3987e5";
const GREEN = "#0ca30c";
const RED = "#d03b3b";
const YELLOW = "#c98500";

export const STATUS_META: Record<string, StatusMeta> = {
  // Opportunities
  open: {
    label: "Open",
    color: BLUE,
    icon: CircleDot,
    hint: "Still being worked",
  },
  won: {
    label: "Won",
    color: GREEN,
    icon: Trophy,
    hint: "The customer accepted",
  },
  lost: {
    label: "Lost",
    color: RED,
    icon: CircleX,
    hint: "The customer declined",
  },
  // Proposal versions
  draft: {
    label: "Draft",
    color: SLATE,
    icon: CircleDashed,
    hint: "Started, no lines yet",
  },
  configured: {
    label: "Configured",
    color: SLATE,
    icon: SlidersHorizontal,
    hint: "Packages chosen",
  },
  proposal_drafted: {
    label: "Proposal drafted",
    color: VIOLET,
    icon: PenLine,
    hint: "Finalized and read-only",
  },
  awaiting_approval: {
    label: "Awaiting approval",
    color: AMBER,
    icon: Hourglass,
    hint: "Waiting for an approver",
  },
  changes_requested: {
    label: "Changes requested",
    color: ORANGE,
    icon: RotateCcw,
    hint: "The approver wants changes",
  },
  approved: {
    label: "Approved",
    color: TEAL,
    icon: BadgeCheck,
    hint: "Ready to share with the customer",
  },
  shared: {
    label: "Shared",
    color: BLUE,
    icon: Send,
    hint: "Sent to the customer, awaiting an answer",
  },
  expired: {
    label: "Expired",
    color: YELLOW,
    icon: Clock,
    hint: "No answer in time",
  },
  // Approval requests
  pending: {
    label: "Pending",
    color: AMBER,
    icon: Hourglass,
    hint: "Waiting for a decision",
  },
  // Customers
  active: {
    label: "Active",
    color: TEAL,
    icon: CircleDot,
    hint: "Current customer",
  },
  inactive: {
    label: "Inactive",
    color: SLATE,
    icon: CircleDashed,
    hint: "Not currently engaged",
  },
};

const FALLBACK: Omit<StatusMeta, "label"> = {
  color: SLATE,
  icon: CircleDot,
  hint: "",
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { ...FALLBACK, label: formatStatus(status) };
}
