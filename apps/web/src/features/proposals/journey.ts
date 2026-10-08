import type { ProposalVersion } from "../../lib/api";

export const JOURNEY_STEPS = [
  { label: "Configure", target: "builder-lines" },
  { label: "Draft with AI", target: "ai-narrative", ai: true },
  { label: "Finalize", target: null },
  { label: "Approval", target: null },
  { label: "Share", target: null },
] as const;

/** Where a version is on the way from first draft to a shared proposal (0-based; 5 means complete). */
export function currentStep(version: ProposalVersion): number {
  switch (version.status) {
    case "draft":
      return 0;
    case "configured":
      return version.narrative_json ? 2 : 1;
    case "proposal_drafted":
    case "awaiting_approval":
    case "changes_requested":
      return 3;
    case "approved":
    case "shared":
      return 4;
    default:
      return JOURNEY_STEPS.length; // won, lost, expired: the journey is complete
  }
}
