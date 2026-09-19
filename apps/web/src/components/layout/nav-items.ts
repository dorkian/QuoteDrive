export const NAV_ITEMS = [
  "Dashboard",
  "Customers",
  "Opportunities",
  "Proposals",
  "Settings",
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
