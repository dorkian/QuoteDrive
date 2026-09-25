import type { Role } from "./api";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  proposal_manager: "Proposal Manager",
  approver: "Approver",
  viewer: "Viewer",
};

// Mirrors the API's `_can_edit` dependency (Admin, Proposal Manager).
export function canEditProposals(role: Role): boolean {
  return role === "admin" || role === "proposal_manager";
}
