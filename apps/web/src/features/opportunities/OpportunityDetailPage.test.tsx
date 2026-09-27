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
  vi.mocked(api.fetchCustomer).mockResolvedValue({
    id: 10,
    organization_id: 1,
    name: "Lombarda Studio Group",
    industry: null,
    status: "active",
  });
  vi.mocked(api.fetchAuditEvents).mockResolvedValue([]);
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

  it("shows the customer, status and the opportunity's activity history", async () => {
    vi.mocked(api.fetchOpportunity).mockResolvedValue(opportunity);
    vi.mocked(api.fetchProposalVersions).mockResolvedValue([]);
    vi.mocked(api.fetchAuditEvents).mockResolvedValue([
      {
        id: 7,
        actor_id: 1,
        actor_name: "Morgan Manager",
        entity_type: "opportunity",
        entity_id: 1,
        action: "create",
        before_json: null,
        after_json: { title: opportunity.title, status: "open" },
        created_at: "2026-09-27T09:00:00Z",
      },
    ]);

    renderAuthenticated(viewerMe);

    expect(
      await screen.findByText("Lombarda Studio Group"),
    ).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(await screen.findByText(/Morgan Manager/)).toBeInTheDocument();
    expect(api.fetchAuditEvents).toHaveBeenCalledWith(
      "stored-token",
      expect.objectContaining({ entityType: "opportunity", entityId: 1 }),
    );
    expect(
      screen.queryByRole("button", { name: "Edit details" }),
    ).not.toBeInTheDocument();
  });

  it("lets a manager edit the title and status", async () => {
    vi.mocked(api.fetchOpportunity).mockResolvedValue(opportunity);
    vi.mocked(api.fetchProposalVersions).mockResolvedValue([]);
    vi.mocked(api.updateOpportunity).mockResolvedValue({
      ...opportunity,
      title: "Fleet Renewal 2027",
      status: "won",
    });

    renderAuthenticated(managerMe);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit details" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit opportunity" });
    const title = within(dialog).getByLabelText("Title");
    fireEvent.change(title, { target: { value: "" } });
    fireEvent.change(title, { target: { value: "  Fleet Renewal 2027 " } });
    fireEvent.change(within(dialog).getByLabelText("Status"), {
      target: { value: "won" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(api.updateOpportunity).toHaveBeenCalledWith("stored-token", 1, {
        title: "Fleet Renewal 2027",
        status: "won",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Fleet Renewal 2027" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The history refetches so the edit shows up.
    await waitFor(() => expect(api.fetchAuditEvents).toHaveBeenCalledTimes(2));
  });

  it("keeps the dialog open with a message when saving fails", async () => {
    vi.mocked(api.fetchOpportunity).mockResolvedValue(opportunity);
    vi.mocked(api.fetchProposalVersions).mockResolvedValue([]);
    vi.mocked(api.updateOpportunity).mockRejectedValue(
      new ApiError(500, "Failed", null),
    );

    renderAuthenticated(managerMe);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit details" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit opportunity" });
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(
      within(dialog).getByText("Enter an opportunity title."),
    ).toBeInTheDocument();
    expect(api.updateOpportunity).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "New title" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(
      await within(dialog).findByText("Couldn't save this opportunity."),
    ).toBeInTheDocument();
  });

  it("offers a legacy status value that isn't in the standard list", async () => {
    vi.mocked(api.fetchOpportunity).mockResolvedValue({
      ...opportunity,
      status: "on_hold",
    });
    vi.mocked(api.fetchProposalVersions).mockResolvedValue([]);

    renderAuthenticated(managerMe);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit details" }),
    );
    const status = within(
      screen.getByRole("dialog", { name: "Edit opportunity" }),
    ).getByLabelText("Status");
    expect(status).toHaveValue("on_hold");
    expect(
      within(status)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Open", "Won", "Lost", "On hold"]);
  });
});
