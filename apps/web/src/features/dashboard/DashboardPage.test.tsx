import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { ApiError } from "../../lib/errors";
import { makeAnalytics } from "./analytics-fixture";
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
    <MemoryRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(api.fetchAuditEvents).mockResolvedValue([]);
});

describe("DashboardPage", () => {
  it("shows the KPIs, every chart and the activity panel once data loads", async () => {
    vi.mocked(api.fetchDashboardAnalytics).mockResolvedValue(makeAnalytics());
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

    expect(
      await screen.findByRole("link", { name: /Open pipeline: \$75\.8K\/mo/ }),
    ).toHaveAttribute("href", "/opportunities");
    expect(
      screen.getByRole("link", { name: /Win rate: 75%/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Awaiting approval: 3/ }),
    ).toHaveAttribute("href", "/approvals");
    expect(
      screen.getByRole("link", { name: /Median approval time: 9 h/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /AI drafts: 83%/ }),
    ).toBeInTheDocument();

    for (const title of [
      "Weekly activity",
      "Proposal outcomes",
      "Proposal pipeline",
      "Package mix",
    ]) {
      expect(screen.getByRole("region", { name: title })).toBeInTheDocument();
    }
    expect(await screen.findByText("created opportunity")).toBeInTheDocument();
    expect(api.fetchDashboardAnalytics).toHaveBeenCalledWith(
      "stored-token",
      "12w",
    );
  });

  it("refetches every chart when the time range changes", async () => {
    vi.mocked(api.fetchDashboardAnalytics).mockImplementation(
      async (_token, range) =>
        makeAnalytics({
          range,
          kpis: {
            ...makeAnalytics().kpis,
            awaiting_approval: range === "4w" ? 1 : 3,
          },
        }),
    );

    renderAuthenticated();
    await screen.findByRole("link", { name: /Awaiting approval: 3/ });

    fireEvent.click(screen.getByRole("button", { name: "4 weeks" }));

    expect(
      await screen.findByRole("link", { name: /Awaiting approval: 1/ }),
    ).toBeInTheDocument();
    expect(api.fetchDashboardAnalytics).toHaveBeenLastCalledWith(
      "stored-token",
      "4w",
    );
    expect(screen.getByRole("button", { name: "4 weeks" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "12 weeks" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows an error with a working retry when analytics fail to load", async () => {
    vi.mocked(api.fetchDashboardAnalytics)
      .mockRejectedValueOnce(new ApiError(500, "Failed", null))
      .mockResolvedValueOnce(makeAnalytics());

    renderAuthenticated();

    expect(
      await screen.findByText("Couldn't load the dashboard."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("link", { name: /Open pipeline/ }),
    ).toBeInTheDocument();
  });

  it("explains empty charts instead of drawing nothing", async () => {
    vi.mocked(api.fetchDashboardAnalytics).mockResolvedValue(
      makeAnalytics({
        kpis: {
          ...makeAnalytics().kpis,
          win_rate: null,
          median_approval_hours: null,
          ai_success_rate: null,
          ai_generations: 0,
          open_pipeline_value: "0",
          open_opportunities: 0,
        },
        stages: [],
        packages: [],
        ai: [],
        weekly: [],
      }),
    );

    renderAuthenticated();

    expect(
      await screen.findByText(
        "Shared proposals and their outcomes will appear here.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Add packages to a proposal to see the mix."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No generations in this range"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(
          "No activity yet. Actions on opportunities will show up here.",
        ),
      ).toBeInTheDocument(),
    );
  });
});
