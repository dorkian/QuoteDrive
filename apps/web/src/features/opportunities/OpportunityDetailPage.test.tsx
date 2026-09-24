import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { OpportunityDetailPage } from "./OpportunityDetailPage";

vi.mock("../../lib/api");

const managerMe: api.Me = {
  user: { id: 1, email: "manager@northstar.example", display_name: "Manager" },
  organization: {
    id: 1,
    name: "Northstar Mobility Advisory",
    slug: "northstar",
  },
  role: "proposal_manager",
};

const viewerMe: api.Me = {
  ...managerMe,
  user: { id: 4, email: "viewer@northstar.example", display_name: "Viewer" },
  role: "viewer",
};

const opportunity: api.Opportunity = {
  id: 1,
  organization_id: 1,
  customer_id: 10,
  owner_id: 1,
  title: "2026 Fleet Modernization & Mobility Services",
  status: "open",
  brief_json: null,
};

function renderAuthenticated(me: api.Me) {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/opportunities/1"]}>
        <Routes>
          <Route
            path="/opportunities/:opportunityId"
            element={<OpportunityDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("OpportunityDetailPage", () => {
  it("lists proposal versions and shows Create draft version for a manager", async () => {
    vi.mocked(api.fetchOpportunity).mockResolvedValue(opportunity);
    vi.mocked(api.fetchProposalVersions).mockResolvedValue([
      {
        id: 5,
        organization_id: 1,
        opportunity_id: 1,
        version_number: 1,
        status: "draft",
        narrative_json: null,
        content_json: { lines: [] },
        total_estimate: "0.00",
        created_by: 1,
      },
    ]);

    renderAuthenticated(managerMe);

    await waitFor(() =>
      expect(screen.getByText("Version 1")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Create draft version" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state and hides Create draft version for a viewer", async () => {
    vi.mocked(api.fetchOpportunity).mockResolvedValue(opportunity);
    vi.mocked(api.fetchProposalVersions).mockResolvedValue([]);

    renderAuthenticated(viewerMe);

    await waitFor(() =>
      expect(screen.getByText("No proposal versions yet.")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Create draft version" }),
    ).not.toBeInTheDocument();
  });
});
