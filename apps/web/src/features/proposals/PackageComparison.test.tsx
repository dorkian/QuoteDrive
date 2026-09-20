import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { PackageComparison } from "./PackageComparison";

vi.mock("../../lib/api");

const viewerMe: api.Me = {
  user: { id: 4, email: "viewer@northstar.example", display_name: "Viewer" },
  organization: {
    id: 1,
    name: "Northstar Mobility Advisory",
    slug: "northstar",
  },
  role: "viewer",
};

const fullCatalogue: api.CatalogueItem[] = [
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
    id: 2,
    organization_id: 1,
    type: "package",
    name: "Hybrid Account Manager",
    category: "hybrid",
    base_monthly_estimate: "549.00",
    active: true,
  },
  {
    id: 3,
    organization_id: 1,
    type: "package",
    name: "Long Distance",
    category: "long_distance",
    base_monthly_estimate: "729.00",
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

function renderComponent() {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(viewerMe);
  return render(
    <AuthProvider>
      <MemoryRouter>
        <PackageComparison />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("PackageComparison", () => {
  it("renders all three packages with vehicle counts, computed estimates, and disclaimers", async () => {
    vi.mocked(api.fetchCatalogueItems).mockResolvedValue(fullCatalogue);

    renderComponent();

    await waitFor(() =>
      expect(screen.getByText("Electric City")).toBeInTheDocument(),
    );
    expect(screen.getByText("Hybrid Account Manager")).toBeInTheDocument();
    expect(screen.getByText("Long Distance")).toBeInTheDocument();

    // Vehicle counts
    expect(screen.getByText("4 vehicles")).toBeInTheDocument();
    expect(screen.getByText("5 vehicles")).toBeInTheDocument();
    expect(screen.getByText("3 vehicles")).toBeInTheDocument();

    // Computed totals:
    // 649 * 4 = 2596.00
    // 549 * 5 = 2745.00
    // 729 * 3 = 2187.00
    expect(screen.getByText(/\$2596\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$2745\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$2187\.00/)).toBeInTheDocument();

    // Per-vehicle base estimates
    expect(screen.getByText("$649.00/mo per vehicle")).toBeInTheDocument();
    expect(screen.getByText("$549.00/mo per vehicle")).toBeInTheDocument();
    expect(screen.getByText("$729.00/mo per vehicle")).toBeInTheDocument();

    // Services, assumptions, timeline headings
    expect(screen.getAllByText("Services included")).toHaveLength(3);
    expect(screen.getAllByText("Assumptions")).toHaveLength(3);
    expect(screen.getAllByText("Timeline")).toHaveLength(3);

    // Disclaimer present
    expect(
      screen.getAllByText("Illustrative planning estimate only."),
    ).toHaveLength(3);
  });

  it("shows an informative message when not all three canonical packages are active", async () => {
    // Only two packages active
    vi.mocked(api.fetchCatalogueItems).mockResolvedValue([
      fullCatalogue[0],
      fullCatalogue[1],
    ]);

    renderComponent();

    await waitFor(() =>
      expect(
        screen.getByText("Package comparison unavailable"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Not all three packages are configured yet/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Electric City")).not.toBeInTheDocument();
  });

  it("computes totals without float-precision drift for non-round prices", async () => {
    vi.mocked(api.fetchCatalogueItems).mockResolvedValue([
      { ...fullCatalogue[0], base_monthly_estimate: "19.99" },
      fullCatalogue[1],
      fullCatalogue[2],
    ]);

    renderComponent();

    // 19.99 * 4 = 79.96 — naive `Number(x) * n` float math can drift here.
    await waitFor(() =>
      expect(screen.getByText(/\$79\.96/)).toBeInTheDocument(),
    );
  });

  it("renders an error state when fetching catalogue items fails", async () => {
    vi.mocked(api.fetchCatalogueItems).mockRejectedValue(
      new Error("Network error"),
    );

    renderComponent();

    await waitFor(() =>
      expect(
        screen.getByText(
          "Couldn't load catalogue packages. Try refreshing the page.",
        ),
      ).toBeInTheDocument(),
    );
  });
});
