import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { ApiError } from "../../lib/errors";
import { DashboardPage } from "./DashboardPage";

vi.mock("../../lib/api");

const mockMe: api.Me = {
  user: {
    id: 1,
    email: "manager@northstar.example",
    display_name: "Proposal Manager",
  },
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
      <DashboardPage />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("DashboardPage", () => {
  it("renders status chips and the activity timeline once data loads", async () => {
    vi.mocked(api.fetchDashboardSummary).mockResolvedValue({
      opportunities_by_status: { open: 2 },
    });
    vi.mocked(api.fetchAuditEvents).mockResolvedValue([
      {
        id: 1,
        actor_id: 1,
        actor_name: "Proposal Manager",
        entity_type: "opportunity",
        entity_id: 1,
        action: "create",
        before_json: null,
        after_json: {
          title: "2026 Fleet Modernization & Mobility Services",
          status: "open",
        },
        created_at: "2026-09-19T12:00:00Z",
      },
    ]);

    renderAuthenticated();

    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "Open: 2" }),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByText("Proposal Manager")).toBeInTheDocument(),
    );
    expect(screen.getByText("created opportunity")).toBeInTheDocument();
    expect(
      screen.getByText("2026 Fleet Modernization & Mobility Services"),
    ).toBeInTheDocument();
  });

  it("shows an error with a working retry when the summary fails to load", async () => {
    vi.mocked(api.fetchDashboardSummary)
      .mockRejectedValueOnce(new ApiError(500, "Failed", null))
      .mockResolvedValueOnce({ opportunities_by_status: { open: 1 } });
    vi.mocked(api.fetchAuditEvents).mockResolvedValue([]);

    renderAuthenticated();

    expect(
      await screen.findByText("Couldn't load the dashboard."),
    ).toBeInTheDocument();
    // An error must not fall through to the misleading empty state.
    expect(
      screen.queryByText("No opportunities yet. Create one to see it here."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("group", { name: "Open: 1" }),
    ).toBeInTheDocument();
  });

  it("shows guidance empty states when there is no data yet", async () => {
    vi.mocked(api.fetchDashboardSummary).mockResolvedValue({
      opportunities_by_status: {},
    });
    vi.mocked(api.fetchAuditEvents).mockResolvedValue([]);

    renderAuthenticated();

    await waitFor(() =>
      expect(
        screen.getByText("No opportunities yet. Create one to see it here."),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          "No activity yet. Actions on opportunities will show up here.",
        ),
      ).toBeInTheDocument(),
    );
  });
});
