const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Role = "admin" | "proposal_manager" | "approver" | "viewer";

export interface Organization {
  id: number;
  name: string;
  slug: string;
}

export interface User {
  id: number;
  email: string;
  display_name: string;
}

export interface Me {
  user: User;
  organization: Organization;
  role: Role;
}

export interface DashboardSummary {
  opportunities_by_status: Record<string, number>;
}

export interface AuditEvent {
  id: number;
  actor_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  created_at: string;
}

export interface Customer {
  id: number;
  organization_id: number;
  name: string;
  industry: string | null;
  status: string;
}

export interface Opportunity {
  id: number;
  organization_id: number;
  customer_id: number;
  owner_id: number;
  title: string;
  status: string;
  brief_json: Record<string, unknown> | null;
}

export interface CatalogueItem {
  id: number;
  organization_id: number;
  type: "package" | "add_on";
  name: string;
  category: string;
  base_monthly_estimate: string;
  active: boolean;
}

export interface EstimateLineInput {
  catalogue_item_id: number;
  quantity: number;
  add_on_item_ids: number[];
}

export interface EstimateLineResult {
  catalogue_item_id: number;
  name: string;
  category: string;
  quantity: number;
  add_on_item_ids: number[];
  unit_estimate: string;
  line_total: string;
}

export interface EstimateCalculateResponse {
  lines: EstimateLineResult[];
  total_estimate: string;
  disclaimer: string;
}

export interface ProposalVersionLine {
  catalogue_item_id: number;
  name: string;
  category: string;
  quantity: number;
  add_on_item_ids: number[];
  unit_estimate: string;
  line_total: string;
  assumptions: string | null;
}

export type ProposalVersionStatus =
  | "draft"
  | "configured"
  | "proposal_drafted"
  | "awaiting_approval"
  | "approved"
  | "shared"
  | "won"
  | "lost"
  | "expired"
  | "changes_requested";

export interface ProposalVersion {
  id: number;
  organization_id: number;
  opportunity_id: number;
  version_number: number;
  status: ProposalVersionStatus;
  content_json: { lines: ProposalVersionLine[] };
  total_estimate: string;
  created_by: number;
}

export interface ProposalVersionLineInput {
  catalogue_item_id: number;
  quantity: number;
  add_on_item_ids: number[];
  assumptions: string | null;
}

export async function demoLogin(email: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error("Invalid demo login");
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchMe(token: string): Promise<Me> {
  const res = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Session expired");
  }
  return (await res.json()) as Me;
}

export async function fetchDashboardSummary(
  token: string,
): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Failed to load dashboard summary");
  }
  return (await res.json()) as DashboardSummary;
}

export async function fetchAuditEvents(
  token: string,
  limit = 20,
): Promise<AuditEvent[]> {
  const res = await fetch(`${API_URL}/audit-events?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Failed to load activity");
  }
  return (await res.json()) as AuditEvent[];
}

export async function fetchOpportunities(
  token: string,
): Promise<Opportunity[]> {
  const res = await fetch(`${API_URL}/opportunities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Failed to load opportunities");
  }
  return (await res.json()) as Opportunity[];
}

export async function fetchOpportunity(
  token: string,
  opportunityId: number,
): Promise<Opportunity> {
  const res = await fetch(`${API_URL}/opportunities/${opportunityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Failed to load opportunity");
  }
  return (await res.json()) as Opportunity;
}

export async function fetchCustomers(token: string): Promise<Customer[]> {
  const res = await fetch(`${API_URL}/customers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Failed to load customers");
  }
  return (await res.json()) as Customer[];
}

export async function fetchCatalogueItems(
  token: string,
): Promise<CatalogueItem[]> {
  const res = await fetch(`${API_URL}/catalogue/items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Failed to load catalogue");
  }
  return (await res.json()) as CatalogueItem[];
}

export async function fetchProposalVersions(
  token: string,
  opportunityId: number,
): Promise<ProposalVersion[]> {
  const res = await fetch(
    `${API_URL}/opportunities/${opportunityId}/versions`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    throw new Error("Failed to load proposal versions");
  }
  return (await res.json()) as ProposalVersion[];
}

export async function fetchProposalVersion(
  token: string,
  versionId: number,
): Promise<ProposalVersion> {
  const res = await fetch(`${API_URL}/proposal-versions/${versionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Failed to load proposal version");
  }
  return (await res.json()) as ProposalVersion;
}

export async function createProposalVersion(
  token: string,
  opportunityId: number,
  fromVersionId?: number,
): Promise<ProposalVersion> {
  const res = await fetch(
    `${API_URL}/opportunities/${opportunityId}/versions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        fromVersionId === undefined ? {} : { from_version_id: fromVersionId },
      ),
    },
  );
  if (!res.ok) {
    throw new Error("Failed to create proposal version");
  }
  return (await res.json()) as ProposalVersion;
}

export async function updateProposalVersion(
  token: string,
  versionId: number,
  lines: ProposalVersionLineInput[],
): Promise<ProposalVersion> {
  const res = await fetch(`${API_URL}/proposal-versions/${versionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lines }),
  });
  if (!res.ok) {
    throw new Error("Failed to save proposal version");
  }
  return (await res.json()) as ProposalVersion;
}

export async function finalizeProposalVersion(
  token: string,
  versionId: number,
): Promise<ProposalVersion> {
  const res = await fetch(
    `${API_URL}/proposal-versions/${versionId}/finalize`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    throw new Error("Failed to finalize proposal version");
  }
  return (await res.json()) as ProposalVersion;
}

export async function calculateEstimate(
  token: string,
  lines: EstimateLineInput[],
): Promise<EstimateCalculateResponse> {
  const res = await fetch(`${API_URL}/estimates/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lines }),
  });
  if (!res.ok) {
    throw new Error("Failed to calculate estimate");
  }
  return (await res.json()) as EstimateCalculateResponse;
}
