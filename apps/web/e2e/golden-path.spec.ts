import { expect, test } from "@playwright/test";

import {
  API_URL,
  APPROVER,
  MANAGER,
  apiToken,
  loginViaUi,
  logout,
} from "./helpers.ts";

const CUSTOMER = "Lombarda Studio Group";
// Unique per run so the approval list link is unambiguous across reruns.
const OPPORTUNITY = `E2E Fleet Renewal ${Date.now()}`;
const LINES = [
  { option: "Electric City · $649.00/mo", quantity: "4" },
  { option: "Hybrid Account Manager · $549.00/mo", quantity: "5" },
  { option: "Long Distance · $729.00/mo", quantity: "3" },
];

test("manager builds and submits a proposal, approver approves, client preview renders", async ({
  page,
  request,
}) => {
  // Manager: create a fresh opportunity for a seeded customer, then a draft.
  await loginViaUi(page, MANAGER);
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "New opportunity" }).click();
  const dialog = page.getByRole("dialog", { name: "New opportunity" });
  await dialog.getByLabel("Customer").selectOption({ label: CUSTOMER });
  await dialog.getByLabel("Title").fill(OPPORTUNITY);
  await dialog.getByRole("button", { name: "Create opportunity" }).click();
  await expect(page.getByRole("heading", { name: OPPORTUNITY })).toBeVisible();
  await expect(page.getByText(CUSTOMER)).toBeVisible();
  await page.getByRole("button", { name: "Create draft version" }).click();
  await expect(page).toHaveURL(/\/opportunities\/\d+\/versions\/\d+$/);
  const versionId = Number(page.url().split("/").pop());

  // Build the three options from the demo scenario.
  for (const [index, line] of LINES.entries()) {
    await page
      .getByRole("combobox", { name: "Package to add" })
      .selectOption({ label: line.option });
    await page.getByRole("button", { name: "Add package line" }).click();
    await page.getByLabel("Quantity").nth(index).fill(line.quantity);
  }
  // 4 × 649 + 5 × 549 + 3 × 729 = 7528.00
  await expect(page.getByText("Total: $7528.00")).toBeVisible();

  await page.getByRole("button", { name: "Finalize", exact: true }).click();
  await page.getByRole("button", { name: "Finalize version" }).click();
  await expect(page.getByText("Proposal drafted")).toBeVisible();

  // No UI exists yet for submit + approval request (follow-up card), so this
  // one step goes through the API as the manager.
  const managerToken = await apiToken(request, MANAGER);
  const approverMe = await (
    await request.get(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${await apiToken(request, APPROVER)}` },
    })
  ).json();
  const auth = { Authorization: `Bearer ${managerToken}` };
  expect(
    (
      await request.post(`${API_URL}/proposal-versions/${versionId}/submit`, {
        headers: auth,
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post(
        `${API_URL}/proposal-versions/${versionId}/approval-request`,
        { headers: auth, data: { assigned_to: approverMe.user.id } },
      )
    ).ok(),
  ).toBeTruthy();
  await logout(page);

  // Approver: find the request, approve it with confirmation.
  await loginViaUi(page, APPROVER);
  await page.goto("/approvals");
  await page
    .getByRole("link", { name: new RegExp(OPPORTUNITY) })
    .first()
    .click();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("button", { name: "Confirm approve" }).click();
  await expect(
    page.getByText("Proposal version approved successfully."),
  ).toBeVisible();

  // Client preview of the approved version.
  await page.goto(`/proposal-versions/${versionId}/preview`);
  await expect(
    page.getByRole("row", { name: "Estimated monthly total $7,528.00" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Illustrative planning estimate only/),
  ).toBeVisible();
});
