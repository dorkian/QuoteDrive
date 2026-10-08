import { Lightbulb, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTip } from "./tips";

/**
 * A one-line, dismissible tip for a first visit. It stays gone once dismissed,
 * and comes back from Help › Show tips again.
 */
export function TipBanner({
  id,
  children,
  ai = false,
  className,
}: {
  id: string;
  children: ReactNode;
  ai?: boolean;
  className?: string;
}) {
  const { visible, dismiss } = useTip(id);
  if (!visible) return null;
  const Icon = ai ? Sparkles : Lightbulb;
  return (
    <aside
      aria-label="Tip"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
        ai ? "border-cyan-400/30 bg-cyan-400/5" : "border-border bg-card",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          ai ? "text-info-foreground" : "text-muted-foreground",
        )}
      />
      <p className="min-w-0 flex-1 text-muted-foreground">
        <span className="font-medium text-foreground">Tip: </span>
        {children}
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={dismiss}
        className="-my-1 shrink-0"
      >
        Got it
      </Button>
    </aside>
  );
}
