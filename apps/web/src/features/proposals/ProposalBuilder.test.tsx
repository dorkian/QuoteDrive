import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { ProposalBuilder } from "./ProposalBuilder";

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

const catalogueItems: api.CatalogueItem[] = [
  {
    id: 1,
    organization_id: 1,
    type: "package",
    name: "Electric City",
    category: "electric_city",
    base_monthly_estimate: "649.00",
    active: true,
  },
  {
    id: 4,
    organization_id: 1,
    type: "add_on",
    name: "Maintenance",
    category: "maintenance",
    base_monthly_estimate: "89.00",
    active: true,
  },
];

function draftVersion(): api.ProposalVersion {
  return {
    id: 5,
    organization_id: 1,
    opportunity_id: 1,
    version_number: 1,
    status: "draft",
    content_json: { lines: [] },
    total_estimate: "0.00",
    created_by: 1,
  };
}

function finalizedVersion(): api.ProposalVersion {
  return {
    id: 6,
    organization_id: 1,
    opportunity_id: 1,
    version_number: 1,
    status: "proposal_drafted",
    content_json: {
      lines: [
        {
          catalogue_item_id: 1,
          name: "Electric City",
          category: "electric_city",
          quantity: 4,
          add_on_item_ids: [],
          unit_estimate: "649.00",
          line_total: "2596.00",
          assumptions: "12-month term",
        },
      ],
    },
    total_estimate: "2596.00",
    created_by: 1,
  };
}

function renderBuilder(me: api.Me, version: api.ProposalVersion) {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  vi.mocked(api.fetchProposalVersion).mockResolvedValue(version);
  vi.mocked(api.fetchCatalogueItems).mockResolvedValue(catalogueItems);
  return render(
    <AuthProvider>
      <MemoryRouter
        initialEntries={[`/opportunities/1/versions/${version.id}`]}
      >
        <Routes>
          <Route
            path="/opportunities/:opportunityId/versions/:versionId"
            element={<ProposalBuilder />}
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(api.fetchAuditEvents).mockResolvedValue([]);
});

describe("ProposalBuilder", () => {
  it("lets a manager add a package line and shows the live-calculated total", async () => {
    vi.mocked(api.calculateEstimate).mockResolvedValue({
      lines: [
        {
          catalogue_item_id: 1,
          name: "Electric City",
          category: "electric_city",
          quantity: 1,
          add_on_item_ids: [],
          unit_estimate: "649.00",
          line_total: "649.00",
        },
      ],
      total_estimate: "649.00",
      disclaimer: "Illustrative planning estimate only.",
    });

    renderBuilder(managerMe, draftVersion());

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add package line" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add package line" }));

    await waitFor(() => expect(api.calculateEstimate).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/Total: \$649\.00/)).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Illustrative planning estimate only."),
    ).toBeInTheDocument();
  });

  it("renders a read-only summary for a finalized (immutable) version", async () => {
    renderBuilder(managerMe, finalizedVersion());

    await waitFor(() =>
      expect(screen.getByText(/Electric City/)).toBeInTheDocument(),
    );
    expect(screen.getByText("12-month term")).toBeInTheDocument();
    expect(screen.getByText("Total: $2596.00")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add package line" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
  });

  it("renders read-only for a viewer even on an editable draft", async () => {
    renderBuilder(viewerMe, draftVersion());

    await waitFor(() =>
      expect(screen.getByText("Version 1")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Add package line" }),
    ).not.toBeInTheDocument();
    expect(api.calculateEstimate).not.toHaveBeenCalled();
  });

  it("saves pending lines before finalizing when Finalize is clicked", async () => {
    vi.mocked(api.calculateEstimate).mockResolvedValue({
      lines: [
        {
          catalogue_item_id: 1,
          name: "Electric City",
          category: "electric_city",
          quantity: 1,
          add_on_item_ids: [],
          unit_estimate: "649.00",
          line_total: "649.00",
        },
      ],
      total_estimate: "649.00",
      disclaimer: "Illustrative planning estimate only.",
    });
    const draft = draftVersion();
    vi.mocked(api.updateProposalVersion).mockResolvedValue(draft);
    vi.mocked(api.finalizeProposalVersion).mockResolvedValue({
      ...draft,
      status: "proposal_drafted",
    });

    renderBuilder(managerMe, draft);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add package line" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add package line" }));
    await waitFor(() => expect(api.calculateEstimate).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Finalize" }));

    await waitFor(() => expect(api.finalizeProposalVersion).toHaveBeenCalled());
    expect(api.updateProposalVersion).toHaveBeenCalledWith(
      "stored-token",
      draft.id,
      expect.arrayContaining([
        expect.objectContaining({ catalogue_item_id: 1 }),
      ]),
    );
    const updateOrder = vi.mocked(api.updateProposalVersion).mock
      .invocationCallOrder[0];
    const finalizeOrder = vi.mocked(api.finalizeProposalVersion).mock
      .invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(finalizeOrder);
  });

  it("handles legacy proposal lines without add_on_item_ids without crashing", async () => {
    const legacyVersion: api.ProposalVersion = {
      ...finalizedVersion(),
      status: "draft",
      content_json: {
        lines: [
          {
            catalogue_item_id: 1,
            name: "Electric City",
            category: "electric_city",
            quantity: 2,
          } as unknown as api.ProposalVersionLine,
        ],
      },
    };
    vi.mocked(api.calculateEstimate).mockResolvedValue({
      lines: [],
      total_estimate: "0.00",
      disclaimer: "Illustrative planning estimate only.",
    });

    renderBuilder(managerMe, legacyVersion);

    await waitFor(() =>
      expect(screen.getByText("Version 1")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Add package line" }),
    ).toBeInTheDocument();
  });

  it("renders the proposal version activity timeline", async () => {
    vi.mocked(api.fetchAuditEvents).mockResolvedValue([
      {
        id: 1,
        actor_id: 1,
        actor_name: "Proposal Manager",
        entity_type: "proposal_version",
        entity_id: 5,
        action: "create",
        before_json: null,
        after_json: { version_number: 1 },
        created_at: new Date().toISOString(),
      },
    ]);

    renderBuilder(managerMe, draftVersion());

    await waitFor(() =>
      expect(screen.getByText("created proposal version")).toBeInTheDocument(),
    );
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });
});


