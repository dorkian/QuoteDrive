import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { ApiError } from "../../lib/errors";
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

function renderAuthenticated(me: api.Me, path = "/opportunities/1") {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
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
  it("shows not-found instead of loading forever for a malformed id", async () => {
    renderAuthenticated(managerMe, "/opportunities/not-a-number");

    expect(
      await screen.findByText(
        "This opportunity doesn't exist or isn't in your organization.",
      ),
    ).toBeInTheDocument();
    expect(api.fetchOpportunity).not.toHaveBeenCalled();
  });

  it("treats a 404 as not found, with no retry", async () => {
    vi.mocked(api.fetchOpportunity).mockRejectedValue(
      new ApiError(404, "Failed", "Not found"),
    );
    vi.mocked(api.fetchProposalVersions).mockResolvedValue([]);

    renderAuthenticated(managerMe);

    expect(
      await screen.findByText(
        "This opportunity doesn't exist or isn't in your organization.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

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
