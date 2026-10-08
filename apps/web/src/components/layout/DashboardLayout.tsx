import { useState, type ReactNode } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { Role } from "../../lib/api";
import { ROLE_LABELS } from "../../lib/roles";
import { AppBreadcrumbs } from "./AppBreadcrumbs";
import { CommandMenu } from "./CommandMenu";
import { Header } from "./Header";
import type { NavItem } from "./nav-items";
import { CrumbLabelProvider } from "./crumb-labels";
import { Sidebar } from "./Sidebar";

const COLLAPSED_KEY = "quotedrive.sidebarCollapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

interface DashboardLayoutProps {
  active: NavItem;
  onSelect: (item: NavItem) => void;
  organizationName: string;
  role: Role;
  onLogout: () => void;
  helpMenu?: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({
  active,
  onSelect,
  organizationName,
  role,
  onLogout,
  helpMenu,
  children,
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Preference only; ignore storage failures.
    }
  }

  return (
    <CrumbLabelProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none md:flex",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <Sidebar active={active} onSelect={onSelect} collapsed={collapsed} />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent aria-describedby={undefined}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar
              active={active}
              onSelect={(item) => {
                onSelect(item);
                setMobileNavOpen(false);
              }}
            />
            {/* The header hides identity below sm; surface it here instead. */}
            <div className="border-t border-sidebar-border px-4 py-3">
              <p className="truncate text-sm font-medium text-foreground">
                {organizationName}
              </p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[role]}
              </p>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            organizationName={organizationName}
            role={role}
            onLogout={onLogout}
            breadcrumbs={<AppBreadcrumbs />}
            onOpenNav={() => setMobileNavOpen(true)}
            onToggleSidebar={toggleCollapsed}
            onOpenSearch={() => setSearchOpen(true)}
            helpMenu={helpMenu}
          />
          <main className="w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>

        <CommandMenu
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSelect={onSelect}
        />
        <Toaster />
      </div>
    </CrumbLabelProvider>
  );
}
