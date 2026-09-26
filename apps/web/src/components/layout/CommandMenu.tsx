import { useEffect } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_ICONS, NAV_ITEMS, type NavItem } from "./nav-items";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: NavItem) => void;
}

/** ⌘K / Ctrl+K navigation palette over the primary nav items. */
export function CommandMenu({
  open,
  onOpenChange,
  onSelect,
}: CommandMenuProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Go to"
      description="Search for a page to open"
    >
      <CommandInput placeholder="Go to…" />
      <CommandList>
        <CommandEmpty>No matching page.</CommandEmpty>
        <CommandGroup heading="Pages">
          {NAV_ITEMS.map((item) => {
            const Icon = NAV_ICONS[item];
            return (
              <CommandItem
                key={item}
                value={item}
                onSelect={() => {
                  onSelect(item);
                  onOpenChange(false);
                }}
              >
                <Icon aria-hidden="true" />
                {item}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
