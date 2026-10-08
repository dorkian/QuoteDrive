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

const listRow: api.Opportunity = {
  id: 1,
  organization_id: 1,
  customer_id: 10,
  owner_id: 1,
  title: "2026 Fleet Modernization",
  status: "open",
  brief_json: null,
  owner_name: "Manager",
  version_count: 0,
  latest_version: null,
  last_activity_at: "2026-09-20T10:00:00Z",
};

/** What the panel loads when it opens a record. */
function mockRecord(
  opportunity: api.Opportunity,
  versions: api.ProposalVersion[] = [],
) {
  vi.mocked(api.fetchOpportunity).mockResolvedValue(opportunity);
  vi.mocked(api.fetchProposalVersions).mockResolvedValue(versions);
  vi.mocked(api.fetchCustomer).mockResolvedValue(customer);
  vi.mocked(api.fetchAuditEvents).mockResolvedValue([]);
}

function renderAuthenticated(
  initialPath = "/opportunities",
  me: api.Me = mockMe,
) {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
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
    expect(screen.getByText("Lombarda Studio Group")).toBeInTheDocument();
  });

  it("opens an opportunity in a side panel from its row, keeping the list", async () => {
    vi.mocked(api.fetchOpportunities).mockResolvedValue([listRow]);
    vi.mocked(api.fetchCustomers).mockResolvedValue([customer]);
    mockRecord(listRow);

    renderAuthenticated();

    fireEvent.click(await screen.findByText("2026 Fleet Modernization"));

    const panel = await screen.findByRole("dialog", {
      name: "2026 Fleet Modernization",
    });
    expect(
      within(panel).getByRole("region", { name: "Next step" }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: /Open full page/ }),
    ).toHaveAttribute("href", "/opportunities/1");
    // The list is still there behind the panel.
    expect(
      screen.getByRole("table", { name: "Opportunities", hidden: true }),
    ).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Close panel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "2026 Fleet Modernization" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("reopens the panel from a shared link", async () => {
    vi.mocked(api.fetchOpportunities).mockResolvedValue([listRow]);
    vi.mocked(api.fetchCustomers).mockResolvedValue([customer]);
    mockRecord(listRow);

    renderAuthenticated("/opportunities?open=1");

    expect(
      await screen.findByRole("dialog", { name: "2026 Fleet Modernization" }),
    ).toBeInTheDocument();
  });

  it("tells a manager to draft the brief with AI when an opportunity has no proposal yet", async () => {
    vi.mocked(api.fetchOpportunities).mockResolvedValue([listRow]);
    vi.mocked(api.fetchCustomers).mockResolvedValue([customer]);
    mockRecord(listRow);

    renderAuthenticated("/opportunities?open=1");

    const panel = await screen.findByRole("dialog", {
      name: "2026 Fleet Modernization",
    });
    expect(
      await within(panel).findByText("Start with a discovery brief"),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("button", { name: "Draft with AI" }),
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

    renderAuthenticated("/opportunities", { ...mockMe, role: "viewer" });

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
    const created: api.Opportunity = {
      id: 42,
      organization_id: 1,
      customer_id: 10,
      owner_id: 1,
      title: "2027 Fleet Renewal",
      status: "open",
      brief_json: null,
    };
    vi.mocked(api.createOpportunity).mockResolvedValue(created);
    mockRecord(created);

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

    // The new opportunity opens in the side panel; no page change.
    expect(
      await screen.findByRole("dialog", { name: "2027 Fleet Renewal" }),
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
