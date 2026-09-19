import { NAV_ITEMS, type NavItem } from "./nav-items";

interface SidebarProps {
  active: NavItem;
  onSelect: (item: NavItem) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-navy-800 bg-navy-900 px-3 py-2 md:h-screen md:w-56 md:flex-col md:overflow-x-visible md:border-b-0 md:border-r md:px-3 md:py-6"
    >
      <div className="hidden px-3 pb-6 text-sm font-semibold tracking-tight text-navy-50 md:block">
        QuoteDrive
      </div>
      {NAV_ITEMS.map((item) => {
        const isActive = item === active;
        return (
          <button
            key={item}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(item)}
            className={`shrink-0 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 ${
              isActive
                ? "bg-navy-800 text-lime-400"
                : "text-navy-300 hover:bg-navy-800 hover:text-navy-50"
            }`}
          >
            {item}
          </button>
        );
      })}
    </nav>
  );
}
