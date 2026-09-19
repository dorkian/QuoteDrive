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
