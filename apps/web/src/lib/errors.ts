import type { Role } from "./api";
import { ROLE_LABELS } from "./roles";

// Kept out of api.ts on purpose: feature tests auto-mock that module, which
// would turn these helpers into no-op mocks.

export const UNAUTHORIZED_EVENT = "quotedrive:unauthorized";

// The API's generic role-guard detail (apps/api/app/api/deps.py). Anything
// else on a 403 is specific enough to show as-is (e.g. self-approval).
const GENERIC_FORBIDDEN_DETAIL = "Insufficient role for this action";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(status: number, message: string, detail: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function throwIfNotOk(
  res: Response,
  message: string,
  { notifyUnauthorized = true }: { notifyUnauthorized?: boolean } = {},
): Promise<void> {
  if (res.ok) {
    return;
  }
  let detail: string | null = null;
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      detail = body.detail;
    }
  } catch {
    // Body wasn't JSON; the status alone is enough to describe the failure.
  }
  if (res.status === 401 && notifyUnauthorized) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  throw new ApiError(res.status, message, detail);
}

export interface ErrorDescription {
  message: string;
  retryable: boolean;
}

interface DescribeOptions {
  // What the user was trying to do, as a verb phrase: "load this opportunity".
  action: string;
  // The thing being loaded, for the not-found copy: "opportunity".
  subject?: string;
  role?: Role;
}

export function describeError(
  err: unknown,
  { action, subject, role }: DescribeOptions,
): ErrorDescription {
  const status = err instanceof ApiError ? err.status : null;
  if (status === 401) {
    return {
      message: "Your session expired. Sign in again.",
      retryable: false,
    };
  }
  if (status === 403) {
    const detail = (err as ApiError).detail;
    if (detail && detail !== GENERIC_FORBIDDEN_DETAIL) {
      return { message: `${detail}.`, retryable: false };
    }
    const who = role ? `Your role (${ROLE_LABELS[role]})` : "Your role";
    return { message: `${who} can't ${action}.`, retryable: false };
  }
  if (status === 404) {
    return {
      message: subject
        ? `This ${subject} doesn't exist or isn't in your organization.`
        : `Couldn't ${action}: it no longer exists.`,
      retryable: false,
    };
  }
  return { message: `Couldn't ${action}.`, retryable: true };
}
