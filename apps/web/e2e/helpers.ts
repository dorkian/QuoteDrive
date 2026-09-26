import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";

export const MANAGER = "manager@northstar.example";
export const APPROVER = "approver@northstar.example";
export const OTHER_TENANT_MANAGER = "manager@harbor.example";

export async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("listitem").filter({ hasText: email }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByText("Sign in as a demo user")).toBeVisible();
}

export async function apiToken(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.post(`${API_URL}/auth/demo-login`, {
    data: { email },
  });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { access_token: string }).access_token;
}
