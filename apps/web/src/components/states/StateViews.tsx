import type { ReactNode } from "react";

import type { Role } from "../../lib/api";
import { ROLE_LABELS } from "../../lib/roles";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400";

/** A pulsing placeholder block. Pages compose these into their own layout's shape. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md border border-navy-800 bg-navy-900 motion-reduce:animate-none ${className}`}
    />
  );
}

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
      className={`flex flex-col gap-3 rounded-md border border-red-900 bg-red-950/40 p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="text-sm text-red-200">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`min-h-10 shrink-0 self-start rounded-md border border-navy-700 bg-navy-800 px-4 text-sm font-medium text-navy-50 transition-colors duration-150 hover:bg-navy-700 sm:self-auto ${FOCUS_RING}`}
        >
          Try again
        </button>
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
    <div className={className}>
      <p className="text-sm text-navy-300">{message}</p>
      {action && <div className="mt-3">{action}</div>}
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
    <div className="mt-6 rounded-md border border-navy-800 bg-navy-900 p-4">
      <p className="text-sm font-medium text-navy-50">
        Your role ({ROLE_LABELS[role]}) can&apos;t {what}.
      </p>
      <p className="mt-1 text-sm text-navy-300">
        Only {allowed} have access. Ask one of them if you need something here.
      </p>
    </div>
  );
}
