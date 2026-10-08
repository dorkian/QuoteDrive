import { LogOut, Menu, PanelLeft, Search } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { Role } from "../../lib/api";
import { ROLE_LABELS } from "../../lib/roles";

interface HeaderProps {
  organizationName: string;
  role: Role;
  onLogout: () => void;
  breadcrumbs?: ReactNode;
  onOpenNav?: () => void;
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
}

export function Header({
  organizationName,
  role,
  onLogout,
  breadcrumbs,
  onOpenNav,
  onToggleSidebar,
  onOpenSearch,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      {onOpenNav && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          onClick={onOpenNav}
          className="-ml-2 md:hidden"
        >
          <Menu />
        </Button>
      )}
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
          className="-ml-2 hidden md:inline-flex"
        >
          <PanelLeft />
        </Button>
      )}
      <div className="min-w-0 flex-1">{breadcrumbs}</div>
      {onOpenSearch && (
        <Button
          variant="outline"
          onClick={onOpenSearch}
          aria-label="Search pages"
          className="shrink-0 px-3 text-muted-foreground lg:w-56 lg:justify-start xl:w-72 2xl:w-96"
        >
          <Search />
          <span className="hidden lg:inline">Go to…</span>
          <kbd className="ml-auto hidden rounded border border-border px-1 font-sans text-[10px] lg:inline">
            ⌘K
          </kbd>
        </Button>
      )}
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium text-foreground">
          {organizationName}
        </p>
        <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Log out"
        title="Log out"
        onClick={onLogout}
      >
        <LogOut />
      </Button>
    </header>
  );
}
