import type { AuditEvent } from "../lib/api";

export interface EventDescription {
  actionDescription: string;
  entityReference: string;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(
  dateString: string,
  now: Date = new Date(),
): string {
  const date = new Date(dateString);
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSeconds) < 60) {
    return "just now";
  }
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }
  return date.toLocaleDateString();
}

export function describeEvent(event: AuditEvent): EventDescription {
  const { entity_type, action, entity_id, before_json, after_json } = event;
  const json = after_json ?? before_json ?? {};

  if (entity_type === "opportunity") {
    const title = (json.title as string | undefined) ?? `#${entity_id}`;
    if (action === "create") {
      return {
        actionDescription: "created opportunity",
        entityReference: title,
      };
    }
    if (action === "update") {
      return {
        actionDescription: "updated opportunity",
        entityReference: title,
      };
    }
    if (action === "delete") {
      return {
        actionDescription: "deleted opportunity",
        entityReference: title,
      };
    }
  }

  if (entity_type === "customer") {
    const name = (json.name as string | undefined) ?? `#${entity_id}`;
    if (action === "create") {
      return {
        actionDescription: "created customer",
        entityReference: name,
      };
    }
    if (action === "update") {
      return {
        actionDescription: "updated customer",
        entityReference: name,
      };
    }
    if (action === "delete") {
      return {
        actionDescription: "deleted customer",
        entityReference: name,
      };
    }
  }

  if (entity_type === "proposal_version") {
    const versionNum = json.version_number as number | undefined;
    const ref = versionNum !== undefined ? `v${versionNum}` : `#${entity_id}`;
    if (action === "create") {
      return {
        actionDescription: "created proposal version",
        entityReference: ref,
      };
    }
    if (action === "update") {
      return {
        actionDescription: "updated proposal version",
        entityReference: ref,
      };
    }
    if (action === "finalize") {
      return {
        actionDescription: "finalized proposal version",
        entityReference: ref,
      };
    }
    if (action === "submit") {
      return {
        actionDescription: "submitted proposal version",
        entityReference: ref,
      };
    }
    if (action === "approve") {
      return {
        actionDescription: "approved proposal version",
        entityReference: ref,
      };
    }
    if (action === "changes_requested") {
      return {
        actionDescription: "requested changes on proposal version",
        entityReference: ref,
      };
    }
    if (action === "archive") {
      return {
        actionDescription: "archived proposal version",
        entityReference: ref,
      };
    }
  }

  if (entity_type === "approval_request") {
    const ref = `#${entity_id}`;
    if (action === "create") {
      return {
        actionDescription: "submitted approval request",
        entityReference: ref,
      };
    }
    if (action === "approve") {
      return {
        actionDescription: "approved request",
        entityReference: ref,
      };
    }
    if (action === "request_changes") {
      return {
        actionDescription: "requested changes on request",
        entityReference: ref,
      };
    }
  }

  // Fallback for any entity_type/action pair without explicit copy above.
  // Nothing ties this file to the backend's record_audit_event(...) call
  // sites, so a new action added there degrades to this generic text with no
  // test failure — the "covers every emitted action" test in
  // ActivityTimeline.test.tsx enumerates every action currently emitted; add
  // a case above (and to that list) when a new one is introduced.
  const cleanAction = action.replace(/_/g, " ");
  const cleanType = entity_type.replace(/_/g, " ");
  return {
    actionDescription: `${cleanAction} ${cleanType}`,
    entityReference: `#${entity_id}`,
  };
}
