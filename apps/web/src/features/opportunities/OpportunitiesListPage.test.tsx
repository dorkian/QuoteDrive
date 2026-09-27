import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { ApiError } from "../../lib/errors";
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

const customer: api.Customer = {
  id: 10,
  organization_id: 1,
  name: "Lombarda Studio Group",
  industry: "Professional Services",
  status: "active",
};

function renderAuthenticated(me: api.Me = mockMe) {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/opportunities"]}>
        <Routes>
          <Route path="/opportunities" element={<OpportunitiesListPage />} />
          <Route
            path="/opportunities/:opportunityId"
            element={<p>Opportunity detail route</p>}
          />
          <Route path="/customers" element={<p>Customers route</p>} />
        </Routes>
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
    expect(
      screen.getByRole("cell", { name: "Lombarda Studio Group" }),
    ).toBeInTheDocument();
  });

  it("points a manager with no customers to the customers page", async () => {
    vi.mocked(api.fetchOpportunities).mockResolvedValue([]);
    vi.mocked(api.fetchCustomers).mockResolvedValue([]);

    renderAuthenticated();

    expect(
      await screen.findByText(
        "No opportunities yet. Add a customer first, then create an opportunity for them.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New opportunity" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to customers" }));
    expect(await screen.findByText("Customers route")).toBeInTheDocument();
  });

  it("shows a plain empty state and no create button for a viewer", async () => {
    vi.mocked(api.fetchOpportunities).mockResolvedValue([]);
    vi.mocked(api.fetchCustomers).mockResolvedValue([customer]);

    renderAuthenticated({ ...mockMe, role: "viewer" });

    expect(
      await screen.findByText("No opportunities yet."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New opportunity" }),
    ).not.toBeInTheDocument();
  });

  it("creates an opportunity for a customer and opens it", async () => {
    vi.mocked(api.fetchOpportunities).mockResolvedValue([]);
    vi.mocked(api.fetchCustomers).mockResolvedValue([customer]);
    vi.mocked(api.createOpportunity).mockResolvedValue({
      id: 42,
      organization_id: 1,
      customer_id: 10,
      owner_id: 1,
      title: "2027 Fleet Renewal",
      status: "open",
      brief_json: null,
    });

    renderAuthenticated();

    fireEvent.click(
      await screen.findByRole("button", { name: "New opportunity" }),
    );
    const dialog = screen.getByRole("dialog", { name: "New opportunity" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create opportunity" }),
    );
    expect(within(dialog).getByText("Choose a customer.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Customer"), {
      target: { value: "10" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create opportunity" }),
    );
    expect(
      within(dialog).getByText("Enter an opportunity title."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: " 2027 Fleet Renewal " },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create opportunity" }),
    );

    expect(
      await screen.findByText("Opportunity detail route"),
    ).toBeInTheDocument();
    expect(api.createOpportunity).toHaveBeenCalledWith("stored-token", {
      customer_id: 10,
      title: "2027 Fleet Renewal",
    });
  });

  it("shows a role error inside the dialog when creation is forbidden", async () => {
    vi.mocked(api.fetchOpportunities).mockResolvedValue([]);
    vi.mocked(api.fetchCustomers).mockResolvedValue([customer]);
    vi.mocked(api.createOpportunity).mockRejectedValue(
      new ApiError(403, "Failed", "Insufficient role for this action"),
    );

    renderAuthenticated();

    fireEvent.click(
      await screen.findByRole("button", { name: "New opportunity" }),
    );
    const dialog = screen.getByRole("dialog", { name: "New opportunity" });
    fireEvent.change(within(dialog).getByLabelText("Customer"), {
      target: { value: "10" },
    });
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "Blocked" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create opportunity" }),
    );

    expect(
      await within(dialog).findByText(
        "Your role (Proposal Manager) can't create this opportunity.",
      ),
    ).toBeInTheDocument();
  });
});
