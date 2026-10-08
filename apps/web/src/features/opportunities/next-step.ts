import type { Opportunity, ProposalVersion } from "../../lib/api";

export type NextStepAction =
  | { kind: "brief" }
  | { kind: "create-draft" }
  | { kind: "open-version"; versionId: number };

export interface NextStep {
  title: string;
  body: string;
  /** Present only when the signed-in role can act on it. */
  cta?: { label: string; action: NextStepAction; ai?: boolean };
  tone: "action" | "waiting" | "done";
}

/**
 * The one thing to do next on an opportunity, from its state. This is what makes
 * the AI drafting step discoverable: with no brief, the first thing offered is
 * "Draft with AI".
 */
export function nextStep(
  opportunity: Opportunity,
  versions: ProposalVersion[],
  canEdit: boolean,
): NextStep {
  const latest = [...versions].sort(
    (a, b) => b.version_number - a.version_number,
  )[0];

  if (opportunity.status === "won" || opportunity.status === "lost") {
    return {
      tone: "done",
      title:
        opportunity.status === "won"
          ? "Won. Nothing left to do."
          : "Closed as lost.",
      body: "The opportunity is closed. Its history stays available below.",
    };
  }

  const hasBrief =
    !!opportunity.brief_json && Object.keys(opportunity.brief_json).length > 0;
  if (!latest) {
    if (!hasBrief) {
      return {
        tone: "action",
        title: "Start with a discovery brief",
        body: "Paste your call notes and AI drafts a summary, requirements and open questions. You review and edit before anything is saved.",
        cta: canEdit
          ? { label: "Draft with AI", action: { kind: "brief" }, ai: true }
          : undefined,
      };
    }
    return {
      tone: "action",
      title: "Build the first proposal",
      body: "Pick packages and add-ons. The estimate is calculated for you, and AI can draft the narrative afterwards.",
      cta: canEdit
        ? { label: "Create draft version", action: { kind: "create-draft" } }
        : undefined,
    };
  }

  const open = (label: string, ai?: boolean) =>
    canEdit
      ? {
          label,
          action: { kind: "open-version" as const, versionId: latest.id },
          ai,
        }
      : undefined;
  const v = `Version ${latest.version_number}`;

  switch (latest.status) {
    case "draft":
    case "configured":
      return {
        tone: "action",
        title: `Finish ${v}`,
        body: "Add the packages, then let AI draft the narrative. Finalize when it reads right.",
        cta: open("Continue proposal"),
      };
    case "proposal_drafted":
      return {
        tone: "action",
        title: `Submit ${v} for approval`,
        body: "It is finalized and read-only. Choose an approver to review it.",
        cta: open("Open proposal"),
      };
    case "awaiting_approval":
      return {
        tone: "waiting",
        title: `${v} is waiting for an approver`,
        body: "You'll see the decision here and on the dashboard. You can't edit it while it waits.",
      };
    case "changes_requested":
      return {
        tone: "action",
        title: `Revise ${v}`,
        body: "The approver asked for changes. Open it to read their comment and make a new version.",
        cta: open("Review feedback"),
      };
    case "approved":
      return {
        tone: "action",
        title: `Share ${v} with the customer`,
        body: "It is approved. Open the client preview, then mark it as shared once it has gone out.",
        cta: open("Open proposal"),
      };
    case "shared":
      return {
        tone: "waiting",
        title: "Waiting for the customer",
        body: "Record the outcome when you hear back: won, lost or expired.",
        cta: open("Record outcome"),
      };
    default:
      return {
        tone: "action",
        title: `${v} has expired`,
        body: "No answer came in time. Create a new version to keep the deal moving.",
        cta: canEdit
          ? { label: "Create draft version", action: { kind: "create-draft" } }
          : undefined,
      };
  }
}
