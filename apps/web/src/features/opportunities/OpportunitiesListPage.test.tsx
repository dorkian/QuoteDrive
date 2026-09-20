import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { OpportunitiesListPage } from "./OpportunitiesListPage";

vi.mock("../../lib/api");

const mockMe: api.Me = {
  user: { id: 1, email: "manager@northstar.example", display_name: "Manager" },
  organization: {
    id: 1,
    name: "Northstar Mobility Advisory",
    slug: "northstar",
  },
  role: "proposal_manager",
};

function renderAuthenticated() {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(mockMe);
  return render(
    <AuthProvider>
      <MemoryRouter>
        <OpportunitiesListPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("OpportunitiesListPage", () => {
  it("renders opportunities joined with their customer name", async () => {
    vi.mocked(api.fetchOpportunities).mockResolvedValue([
      {
        id: 1,
        organization_id: 1,
        customer_id: 10,
        owner_id: 1,
        title: "2026 Fleet Modernization & Mobility Services",
        status: "open",
        brief_json: null,
      },
    ]);
    vi.mocked(api.fetchCustomers).mockResolvedValue([
      {
        id: 10,
        organization_id: 1,
        name: "Lombarda Studio Group",
        industry: "Professional Services",
        status: "active",
      },
    ]);

    renderAuthenticated();

    await waitFor(() =>
      expect(
        screen.getByText("2026 Fleet Modernization & Mobility Services"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Lombarda Studio Group")).toBeInTheDocument();
  });

  it("shows an empty state when there are no opportunities", async () => {
    vi.mocked(api.fetchOpportunities).mockResolvedValue([]);
    vi.mocked(api.fetchCustomers).mockResolvedValue([]);

    renderAuthenticated();

    await waitFor(() =>
      expect(screen.getByText("No opportunities yet.")).toBeInTheDocument(),
    );
  });
});
