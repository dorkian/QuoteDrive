import { cn } from "@/lib/utils";
import { FOCUS_RING } from "@/components/ui/variants";
import { NAV_ICONS, NAV_ITEMS, type NavItem } from "./nav-items";

interface SidebarProps {
  active: NavItem;
  onSelect: (item: NavItem) => void;
  // Icon-only rail; labels stay available as accessible names.
  collapsed?: boolean;
}

export function Sidebar({ active, onSelect, collapsed = false }: SidebarProps) {
  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-2 py-4">
      <div
        className={cn(
          "mb-4 flex h-8 items-center gap-2 px-2 text-sm font-semibold tracking-tight text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background text-xs font-bold text-foreground"
        >
          Q
        </span>
        {!collapsed && <span>QuoteDrive</span>}
      </div>
      {NAV_ITEMS.map((item) => {
        const isActive = item === active;
        const Icon = NAV_ICONS[item];
        return (
          <button
            key={item}
            type="button"
            aria-current={isActive ? "page" : undefined}
            aria-label={collapsed ? item : undefined}
            title={collapsed ? item : undefined}
            onClick={() => onSelect(item)}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors duration-150",
              FOCUS_RING,
              collapsed && "justify-center px-0",
              isActive
                ? "bg-sidebar-accent text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {!collapsed && item}
          </button>
        );
      })}
    </nav>
  );
}
