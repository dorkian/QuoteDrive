import type { ReactNode } from "react";

import type { Role } from "../../lib/api";
import { Header } from "./Header";
import type { NavItem } from "./nav-items";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  active: NavItem;
  onSelect: (item: NavItem) => void;
  organizationName: string;
  role: Role;
  onLogout: () => void;
  children: ReactNode;
}

export function DashboardLayout({
  active,
  onSelect,
  organizationName,
  role,
  onLogout,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-navy-950 text-navy-50 md:flex-row">
      <Sidebar active={active} onSelect={onSelect} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          organizationName={organizationName}
          role={role}
          onLogout={onLogout}
        />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
