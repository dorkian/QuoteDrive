import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ExternalLink, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { FOCUS_RING } from "@/components/ui/variants";
import { cn } from "@/lib/utils";

/**
 * A wide detail panel that slides in from the right. It behaves as a modal:
 * the page dims, focus is trapped, Esc closes it. The list stays visible
 * behind the dim, so you keep your place. Full screen on phones.
 */
export function EntityPanel({
  open,
  onOpenChange,
  title,
  description,
  badge,
  avatar,
  fullPageHref,
  footer,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  avatar?: ReactNode;
  fullPageHref?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="panel-overlay fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          data-slot="entity-panel"
          className={cn(
            "panel-content fixed inset-y-0 right-0 z-50 flex w-full max-w-[44rem] flex-col border-l border-border bg-popover text-popover-foreground shadow-2xl outline-none sm:w-[44rem]",
            className,
          )}
        >
          <header className="flex items-start gap-3 border-b border-border px-5 py-4">
            {avatar}
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-lg font-semibold tracking-tight text-foreground">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description asChild>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </div>
              </DialogPrimitive.Description>
              {badge && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {badge}
                </div>
              )}
            </div>
            <div className="-mr-1 flex shrink-0 items-center gap-1">
              {fullPageHref && (
                <Link
                  to={fullPageHref}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground",
                    FOCUS_RING,
                  )}
                >
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                  Open full page
                </Link>
              )}
              <DialogPrimitive.Close
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground",
                  FOCUS_RING,
                )}
              >
                <XIcon aria-hidden="true" className="size-4" />
                <span className="sr-only">Close panel</span>
              </DialogPrimitive.Close>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
              {footer}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
