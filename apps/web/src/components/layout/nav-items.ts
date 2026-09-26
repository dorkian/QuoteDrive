import {
  CheckSquare,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Target,
  Users,
} from "lucide-react";

export const NAV_ITEMS = [
  "Dashboard",
  "Customers",
  "Opportunities",
  "Proposals",
  "Approvals",
  "Settings",
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

export const NAV_PATHS: Record<NavItem, string> = {
  Dashboard: "/",
  Customers: "/customers",
  Opportunities: "/opportunities",
  Proposals: "/proposals",
  Approvals: "/approvals",
  Settings: "/settings",
};

export const NAV_ICONS: Record<NavItem, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Customers: Users,
  Opportunities: Target,
  Proposals: FileText,
  Approvals: CheckSquare,
  Settings: Settings,
};

export function navItemForPath(pathname: string): NavItem {
  const match = NAV_ITEMS.find(
    (item) => item !== "Dashboard" && pathname.startsWith(NAV_PATHS[item]),
  );
  return match ?? "Dashboard";
}
