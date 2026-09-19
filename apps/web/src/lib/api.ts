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
