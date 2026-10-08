import { CircleHelp, Compass, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resetTips } from "../../features/onboarding/tips";
import { useTour } from "../../features/onboarding/tour-context";
import { useAuth } from "../../lib/auth-context";

/** Replay the product tour or bring the first-visit tips back. */
export function HelpMenu({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { me } = useAuth();
  const { start } = useTour();
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help and tour"
          data-tour="help"
        >
          <CircleHelp aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Help</DropdownMenuLabel>
        <DropdownMenuItem onSelect={start}>
          <Compass aria-hidden="true" className="size-4" />
          Take the product tour
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => me && resetTips(me.user.id)}>
          <Lightbulb aria-hidden="true" className="size-4" />
          Show tips again
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Press ⌘K anywhere to jump to a page.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
