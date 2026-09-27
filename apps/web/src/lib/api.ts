import { throwIfNotOk } from "./errors";

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
  actor_name: string;
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
  narrative_json:
    | (NarrativeOutput & {
        provider: string;
        model: string;
        generated_at: string;
      })
    | null;
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
  await throwIfNotOk(res, "Invalid demo login", { notifyUnauthorized: false });
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchMe(token: string): Promise<Me> {
  const res = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Session expired", { notifyUnauthorized: false });
  return (await res.json()) as Me;
}

export async function fetchDashboardSummary(
  token: string,
): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load dashboard summary");
  return (await res.json()) as DashboardSummary;
}

export interface FetchAuditEventsOptions {
  limit?: number;
  entityType?: string;
  entityId?: number;
  beforeId?: number;
}

export async function fetchAuditEvents(
  token: string,
  opts?: FetchAuditEventsOptions,
): Promise<AuditEvent[]> {
  const url = new URL(`${API_URL}/audit-events`);
  if (opts?.limit !== undefined) {
    url.searchParams.set("limit", String(opts.limit));
  }
  if (opts?.entityType !== undefined) {
    url.searchParams.set("entity_type", opts.entityType);
  }
  if (opts?.entityId !== undefined) {
    url.searchParams.set("entity_id", String(opts.entityId));
  }
  if (opts?.beforeId !== undefined) {
    url.searchParams.set("before_id", String(opts.beforeId));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load activity");
  return (await res.json()) as AuditEvent[];
}

export async function fetchOpportunities(
  token: string,
): Promise<Opportunity[]> {
  const res = await fetch(`${API_URL}/opportunities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load opportunities");
  return (await res.json()) as Opportunity[];
}

export async function fetchOpportunity(
  token: string,
  opportunityId: number,
): Promise<Opportunity> {
  const res = await fetch(`${API_URL}/opportunities/${opportunityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load opportunity");
  return (await res.json()) as Opportunity;
}

export async function fetchCustomers(
  token: string,
  query?: string,
): Promise<Customer[]> {
  const url = new URL(`${API_URL}/customers`);
  if (query && query.trim()) {
    url.searchParams.set("q", query.trim());
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load customers");
  return (await res.json()) as Customer[];
}

export async function fetchCustomer(
  token: string,
  customerId: number,
): Promise<Customer> {
  const res = await fetch(`${API_URL}/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load customer");
  return (await res.json()) as Customer;
}

export interface CustomerInput {
  name: string;
  industry: string | null;
}

export async function createCustomer(
  token: string,
  input: CustomerInput,
): Promise<Customer> {
  const res = await fetch(`${API_URL}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(res, "Failed to create customer");
  return (await res.json()) as Customer;
}

export async function updateCustomer(
  token: string,
  customerId: number,
  input: Partial<CustomerInput> & { status?: string },
): Promise<Customer> {
  const res = await fetch(`${API_URL}/customers/${customerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(res, "Failed to update customer");
  return (await res.json()) as Customer;
}

export async function deleteCustomer(
  token: string,
  customerId: number,
): Promise<void> {
  const res = await fetch(`${API_URL}/customers/${customerId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to delete customer");
}

export async function createOpportunity(
  token: string,
  input: { customer_id: number; title: string },
): Promise<Opportunity> {
  const res = await fetch(`${API_URL}/opportunities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(res, "Failed to create opportunity");
  return (await res.json()) as Opportunity;
}

export async function updateOpportunity(
  token: string,
  opportunityId: number,
  input: { title?: string; status?: string },
): Promise<Opportunity> {
  const res = await fetch(`${API_URL}/opportunities/${opportunityId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(res, "Failed to update opportunity");
  return (await res.json()) as Opportunity;
}

export async function fetchCatalogueItems(
  token: string,
): Promise<CatalogueItem[]> {
  const res = await fetch(`${API_URL}/catalogue/items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load catalogue");
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
  await throwIfNotOk(res, "Failed to load proposal versions");
  return (await res.json()) as ProposalVersion[];
}

export async function fetchProposalVersion(
  token: string,
  versionId: number,
): Promise<ProposalVersion> {
  const res = await fetch(`${API_URL}/proposal-versions/${versionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load proposal version");
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
  await throwIfNotOk(res, "Failed to create proposal version");
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
  await throwIfNotOk(res, "Failed to save proposal version");
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
  await throwIfNotOk(res, "Failed to finalize proposal version");
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
  await throwIfNotOk(res, "Failed to calculate estimate");
  return (await res.json()) as EstimateCalculateResponse;
}

export type ApprovalRequestStatus =
  "pending" | "approved" | "changes_requested";

export interface ApprovalRequest {
  id: number;
  organization_id: number;
  proposal_version_id: number;
  requested_by: number;
  assigned_to: number;
  status: ApprovalRequestStatus;
  decision_at: string | null;
  created_at: string;
  opportunity_id: number;
  opportunity_title: string;
  version_number: number;
  requested_by_name: string;
  assigned_to_name: string;
}

export async function fetchApprovalRequests(
  token: string,
  status?: ApprovalRequestStatus,
): Promise<ApprovalRequest[]> {
  const url = new URL(`${API_URL}/approval-requests`);
  if (status) {
    url.searchParams.set("status", status);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load approval requests");
  return (await res.json()) as ApprovalRequest[];
}

export async function fetchApprovalRequest(
  token: string,
  id: number,
): Promise<ApprovalRequest> {
  const res = await fetch(`${API_URL}/approval-requests/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res, "Failed to load approval request");
  return (await res.json()) as ApprovalRequest;
}

export async function approveRequest(
  token: string,
  id: number,
  comment?: string,
): Promise<ApprovalRequest> {
  const res = await fetch(`${API_URL}/approval-requests/${id}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(comment ? { comment } : {}),
  });
  await throwIfNotOk(res, "Failed to approve request");
  return (await res.json()) as ApprovalRequest;
}

export async function requestChanges(
  token: string,
  id: number,
  comment: string,
): Promise<ApprovalRequest> {
  const res = await fetch(
    `${API_URL}/approval-requests/${id}/request-changes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ comment }),
    },
  );
  await throwIfNotOk(res, "Failed to request changes");
  return (await res.json()) as ApprovalRequest;
}

export function canDecideApproval(role: string): boolean {
  return role === "admin" || role === "approver";
}

export function isBlank(str: string): boolean {
  return str.trim().length === 0;
}

// Every state downstream of approval: the version is frozen (ADR-006) and its
// content — including any saved narrative — has passed human review.
const PREVIEWABLE_STATUSES: ReadonlySet<ProposalVersionStatus> = new Set([
  "approved",
  "shared",
  "won",
  "lost",
  "expired",
]);

export function isPreviewableStatus(status: ProposalVersionStatus): boolean {
  return PREVIEWABLE_STATUSES.has(status);
}

export interface NarrativeOutput {
  executive_summary: string;
  recommended_approach: string;
  scope: string;
  assumptions_exclusions: string[];
  next_steps: string[];
  email_draft: string;
}

export interface ProposalNarrativeResponse extends NarrativeOutput {
  disclaimer: string;
  provider: string;
  model: string;
}

export async function generateProposalNarrative(
  token: string,
  versionId: number,
  timeline?: string,
): Promise<ProposalNarrativeResponse> {
  const res = await fetch(`${API_URL}/ai/proposal-narrative`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ proposal_version_id: versionId, timeline }),
  });
  await throwIfNotOk(res, "Failed to generate narrative");
  return (await res.json()) as ProposalNarrativeResponse;
}

export async function saveProposalVersionNarrative(
  token: string,
  versionId: number,
  narrative: NarrativeOutput & { provider: string; model: string },
): Promise<ProposalVersion> {
  const res = await fetch(
    `${API_URL}/proposal-versions/${versionId}/narrative`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(narrative),
    },
  );
  await throwIfNotOk(res, "Failed to save narrative");
  return (await res.json()) as ProposalVersion;
}

export interface DiscoveryBrief {
  summary: string;
  requirements: string[];
  open_questions: string[];
  unknowns: string[];
}

export interface DiscoveryBriefResponse extends DiscoveryBrief {
  disclaimer: string;
  provider: string;
  model: string;
}

export async function generateDiscoveryBrief(
  token: string,
  opportunityId: number,
  notes: string,
): Promise<DiscoveryBriefResponse> {
  const res = await fetch(`${API_URL}/ai/discovery-brief`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ opportunity_id: opportunityId, notes }),
  });
  await throwIfNotOk(res, "Failed to draft discovery brief");
  return (await res.json()) as DiscoveryBriefResponse;
}

// Saving goes through the audited opportunity PATCH, after human review.
export async function saveOpportunityBrief(
  token: string,
  opportunityId: number,
  brief: DiscoveryBrief & { provider: string; model: string },
): Promise<Opportunity> {
  const res = await fetch(`${API_URL}/opportunities/${opportunityId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ brief_json: brief }),
  });
  await throwIfNotOk(res, "Failed to save discovery brief");
  return (await res.json()) as Opportunity;
}
