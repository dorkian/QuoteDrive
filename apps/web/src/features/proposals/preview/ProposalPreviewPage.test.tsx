import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../../lib/api";
import { AuthProvider } from "../../../lib/auth-context";
import { ProposalPreviewPage } from "./ProposalPreviewPage";

vi.mock("../../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/api")>();
  return {
    ...actual,
    fetchMe: vi.fn(),
    fetchProposalVersion: vi.fn(),
    fetchOpportunity: vi.fn(),
    fetchCustomer: vi.fn(),
  };
});

const viewerMe: api.Me = {
  user: { id: 4, email: "viewer@northstar.example", display_name: "Viewer" },
  organization: {
    id: 1,
    name: "Northstar Mobility Advisory",
    slug: "northstar",
  },
  role: "viewer",
};

const opportunity: api.Opportunity = {
  id: 1,
  organization_id: 1,
  customer_id: 7,
  owner_id: 2,
  title: "Fleet renewal 2027",
  status: "open",
  brief_json: null,
};

const customer: api.Customer = {
  id: 7,
  organization_id: 1,
  name: "Lombarda Studio Group",
  industry: "Professional Services",
  status: "active",
};

const narrative: NonNullable<api.ProposalVersion["narrative_json"]> = {
  executive_summary: "Lombarda moves 12 vehicles onto a managed plan.",
  recommended_approach: "Phase the electric city cars in first.",
  scope: "Twelve vehicles across three office locations.",
  assumptions_exclusions: ["Standard mileage bands apply."],
  next_steps: ["Confirm vehicle mix with facilities."],
  email_draft: "Hi Marco, please find our proposal attached.",
  provider: "openrouter",
  model: "anthropic/claude-3-haiku",
  generated_at: "2026-09-24T10:00:00Z",
};

function version(
  overrides: Partial<api.ProposalVersion> = {},
): api.ProposalVersion {
  return {
    id: 9,
    organization_id: 1,
    opportunity_id: 1,
    version_number: 2,
    status: "approved",
    content_json: {
      lines: [
        {
          catalogue_item_id: 1,
          name: "Electric City",
          category: "electric_city",
          quantity: 4,
          add_on_item_ids: [],
          unit_estimate: "738.00",
          line_total: "2952.00",
          assumptions: "36-month term",
        },
      ],
    },
    narrative_json: narrative,
    total_estimate: "2952.00",
    created_by: 2,
    ...overrides,
  };
}

function renderPreview(versionToLoad: api.ProposalVersion) {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(viewerMe);
  vi.mocked(api.fetchProposalVersion).mockResolvedValue(versionToLoad);
  vi.mocked(api.fetchOpportunity).mockResolvedValue(opportunity);
  vi.mocked(api.fetchCustomer).mockResolvedValue(customer);
  return render(
    <AuthProvider>
      <MemoryRouter
        initialEntries={[`/proposal-versions/${versionToLoad.id}/preview`]}
      >
        <Routes>
          <Route
            path="/proposal-versions/:versionId/preview"
            element={<ProposalPreviewPage />}
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("ProposalPreviewPage", () => {
  it("renders the approved snapshot: header, narrative, packages, total and disclaimer", async () => {
    renderPreview(version());

    expect(
      await screen.findByRole("heading", { name: "Fleet renewal 2027" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Northstar Mobility Advisory · Proposal for Lombarda Studio Group",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Lombarda moves 12 vehicles onto a managed plan."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Confirm vehicle mix with facilities."),
    ).toBeInTheDocument();
    expect(screen.getByText("36-month term")).toBeInTheDocument();
    expect(screen.getAllByText("$2,952.00")).toHaveLength(2);
    expect(
      screen.getByText(/Illustrative planning estimate only\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Synthetic demo data/)).toBeInTheDocument();
    expect(api.fetchCustomer).toHaveBeenCalledWith("stored-token", 7);
  });

  it("keeps the internal cover-email draft and AI provenance out of the client document", async () => {
    renderPreview(version());

    await screen.findByRole("heading", { name: "Fleet renewal 2027" });
    expect(
      screen.queryByText("Hi Marco, please find our proposal attached."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/openrouter/i)).not.toBeInTheDocument();
  });

  it("shows pricing with a clear notice when no narrative was saved", async () => {
    renderPreview(version({ narrative_json: null }));

    expect(
      await screen.findByText(/No narrative was saved for this version/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Proposed packages" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Executive summary" }),
    ).not.toBeInTheDocument();
  });

  it("blocks versions that are not approved and never shows their draft narrative", async () => {
    renderPreview(version({ status: "awaiting_approval" }));

    expect(
      await screen.findByRole("heading", {
        name: "Version 2 isn't approved yet",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("awaiting approval")).toBeInTheDocument();
    expect(
      screen.queryByText("Lombarda moves 12 vehicles onto a managed plan."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Print or save as PDF" }),
    ).not.toBeInTheDocument();
  });

  it("shows a load error when the version can't be fetched (e.g. another tenant's id)", async () => {
    localStorage.setItem("quotedrive.token", "stored-token");
    vi.mocked(api.fetchMe).mockResolvedValue(viewerMe);
    vi.mocked(api.fetchProposalVersion).mockRejectedValue(
      new Error("Failed to load proposal version"),
    );
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/proposal-versions/999/preview"]}>
          <Routes>
            <Route
              path="/proposal-versions/:versionId/preview"
              element={<ProposalPreviewPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This proposal couldn't be loaded",
    );
  });

  it("opens the browser print dialog from the Print button", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPreview(version());

    fireEvent.click(
      await screen.findByRole("button", { name: "Print or save as PDF" }),
    );
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it("shows the demo login screen when there is no session", async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/proposal-versions/9/preview"]}>
          <Routes>
            <Route
              path="/proposal-versions/:versionId/preview"
              element={<ProposalPreviewPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(
      await screen.findByText(/Sign in as a demo user/),
    ).toBeInTheDocument();
    expect(api.fetchProposalVersion).not.toHaveBeenCalled();
  });
});
