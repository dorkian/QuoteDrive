import { expect, test } from "@playwright/test";

import { API_URL, MANAGER, apiToken, loginViaUi } from "./helpers.ts";

// Unique per run so reruns never collide with an earlier customer.
const STAMP = Date.now();
const CUSTOMER = `E2E Profile Co ${STAMP}`;
const OPPORTUNITY = `E2E Profile Renewal ${STAMP}`;

test("a customer opens as a profile modal and its opportunity stacks on top without leaving the page", async ({
  page,
  request,
}) => {
  const auth = { Authorization: `Bearer ${await apiToken(request, MANAGER)}` };
  const created = await request.post(`${API_URL}/customers`, {
    headers: auth,
    data: {
      name: CUSTOMER,
      industry: "Logistics",
      website: "https://e2e-profile.example",
      hq_city: "Lisbon",
      hq_country: "Portugal",
      company_size: "51-200",
      about: "Fictional freight forwarder used by the end-to-end tests.",
      industry_tags: ["Freight", "Customs"],
      contact_name: "Rita Fonseca",
      contact_title: "Head of Operations",
      contact_email: "rita@e2e-profile.example",
    },
  });
  expect(created.ok()).toBeTruthy();
  const customerId = ((await created.json()) as { id: number }).id;
  const opportunity = await request.post(`${API_URL}/opportunities`, {
    headers: auth,
    data: { customer_id: customerId, title: OPPORTUNITY },
  });
  expect(opportunity.ok()).toBeTruthy();

  await loginViaUi(page, MANAGER);
  await page.goto("/customers");
  await page.getByPlaceholder(/Search/).fill(CUSTOMER);
  await page.getByRole("row", { name: new RegExp(CUSTOMER) }).click();

  // The profile shows what the proposal drafter will know about this customer.
  const modal = page.getByRole("dialog", { name: CUSTOMER });
  await expect(modal).toBeVisible();
  await expect(modal.getByText("Lisbon, Portugal")).toBeVisible();
  await expect(modal.getByText("51-200 people")).toBeVisible();
  await expect(modal.getByText("Freight", { exact: true })).toBeVisible();
  await expect(modal.getByText("Rita Fonseca")).toBeVisible();
  await expect(modal.getByText("Head of Operations")).toBeVisible();
  await expect(
    modal.getByRole("link", { name: /e2e-profile\.example/ }),
  ).toHaveAttribute("href", "https://e2e-profile.example");
  await expect(modal.getByRole("link", { name: "Email" })).toHaveAttribute(
    "href",
    "mailto:rita@e2e-profile.example",
  );
  await expect(modal.getByText("Open pipeline")).toBeVisible();

  // Opening one of its opportunities stacks a panel on top; the URL keeps both.
  await modal.getByRole("button", { name: new RegExp(OPPORTUNITY) }).click();
  const panel = page.getByRole("dialog", { name: OPPORTUNITY });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/\/customers\?.*opportunity=\d+/);

  // Esc peels one layer at a time: panel first, then the customer.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(page).toHaveURL(/\/customers$/);
});
