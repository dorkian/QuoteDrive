import { Link } from "react-router-dom";

import { FOCUS_RING } from "@/components/ui/variants";
import { cn } from "@/lib/utils";
import {
  NAV_ICONS,
  NAV_ITEMS,
  NAV_PATHS,
} from "../../../components/layout/nav-items";

/**
 * The client preview lives outside the app shell so it prints cleanly, but it
 * should never be a dead end on screen: the full menu is one click away.
 * Hidden when printing.
 */
export function PreviewNav() {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur print:hidden"
    >
      <div className="mx-auto flex max-w-[52rem] items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        <Link
          to="/"
          aria-label="QuoteDrive home"
          className={cn(
            "mr-2 grid size-8 shrink-0 place-items-center rounded-md border border-border bg-card text-sm font-bold text-foreground",
            FOCUS_RING,
          )}
        >
          Q
        </Link>
        {NAV_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item];
          return (
            <Link
              key={item}
              to={NAV_PATHS[item]}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground",
                FOCUS_RING,
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {item}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
