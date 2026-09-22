export const NAV_ITEMS = [
  "Dashboard",
  "Customers",
  "Opportunities",
  "Proposals",
  "Approvals",
  "Settings",
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
