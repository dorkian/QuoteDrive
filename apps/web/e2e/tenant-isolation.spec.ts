import { expect, test } from "@playwright/test";

import {
  API_URL,
  MANAGER,
  OTHER_TENANT_MANAGER,
  apiToken,
  loginViaUi,
} from "./helpers.ts";

test("an opportunity from another tenant is not found", async ({
  page,
  request,
}) => {
  // Find the other tenant's opportunity id as that tenant (seed_e2e).
  const otherToken = await apiToken(request, OTHER_TENANT_MANAGER);
  const opportunities = (await (
    await request.get(`${API_URL}/opportunities`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    })
  ).json()) as { id: number; title: string }[];
  const foreign = opportunities.find(
    (o) => o.title === "Harbor Port Shuttle Fleet",
  );
  expect(foreign, "run scripts.seed_e2e first").toBeDefined();

  // The API refuses it for a Northstar user...
  const managerToken = await apiToken(request, MANAGER);
  const res = await request.get(`${API_URL}/opportunities/${foreign!.id}`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  expect(res.status()).toBe(404);

  // ...and the UI shows the not-found state, not the other tenant's data.
  await loginViaUi(page, MANAGER);
  await page.goto(`/opportunities/${foreign!.id}`);
  await expect(
    page.getByText(
      "This opportunity doesn't exist or isn't in your organization.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Harbor Port Shuttle Fleet")).toHaveCount(0);
});
