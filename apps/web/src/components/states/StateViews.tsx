import { CircleAlert, Inbox, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { CARD_CLASSES } from "@/components/ui/variants";
import { cn } from "@/lib/utils";
import type { Role } from "../../lib/api";
import { ROLE_LABELS } from "../../lib/roles";

/** A pulsing placeholder block. Pages compose these into their own layout's shape. */
export { Skeleton } from "@/components/ui/skeleton";

/** Announces a loading region to assistive tech; children are the skeleton shapes. */
export function LoadingRegion({
  label,
  className = "mt-6",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className} role="status" aria-label={label}>
      {children}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className = "mt-6",
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="flex items-start gap-2 text-sm text-destructive-foreground">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="self-start sm:self-auto"
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  message,
  action,
  className = "mt-6",
}: {
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Inbox aria-hidden="true" className="size-4 shrink-0" />
        {message}
      </p>
      {action}
    </div>
  );
}

/** Shown in place of a page the current role can't use, instead of a failed fetch. */
export function ForbiddenState({
  role,
  what,
  allowed,
}: {
  role: Role;
  // Verb phrase for what's restricted: "review approval requests".
  what: string;
  // Who can: "Approvers and Admins".
  allowed: string;
}) {
  return (
    <div className={cn(CARD_CLASSES, "mt-6 p-4")}>
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Lock aria-hidden="true" className="size-4 shrink-0 text-warning" />
        Your role ({ROLE_LABELS[role]}) can&apos;t {what}.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Only {allowed} have access. Ask one of them if you need something here.
      </p>
    </div>
  );
}
