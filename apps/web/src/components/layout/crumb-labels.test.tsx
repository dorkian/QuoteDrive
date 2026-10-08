import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { AppBreadcrumbs } from "./AppBreadcrumbs";
import { useCrumbLabel } from "./crumb-context";
import { CrumbLabelProvider } from "./crumb-labels";
import { useOpportunityCrumb } from "./use-opportunity-crumb";

vi.mock("../../lib/api");

function Page({ label }: { label: string | null }) {
  useCrumbLabel("/opportunities/5", label);
  return null;
}

function Named({ id }: { id: number }) {
  useOpportunityCrumb(id);
  return null;
}

function renderTrail(path: string, page: React.ReactNode) {
  localStorage.setItem("quotedrive.token", "t");
  vi.mocked(api.fetchMe).mockResolvedValue({
    user: { id: 1, email: "a", display_name: "A" },
    organization: { id: 1, name: "N", slug: "n" },
    role: "admin",
  });
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <CrumbLabelProvider>
          <AppBreadcrumbs />
          {page}
        </CrumbLabelProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("breadcrumb labels", () => {
  it("falls back to the generic label until a page names itself", () => {
    renderTrail("/opportunities/5", null);
    expect(screen.getByText("Opportunity")).toBeInTheDocument();
  });

  it("shows the real name while the page is mounted, and reverts after", () => {
    const { rerender } = renderTrail(
      "/opportunities/5",
      <Page label="Regional Delivery Fleet" />,
    );
    expect(screen.getByText("Regional Delivery Fleet")).toBeInTheDocument();
    expect(screen.queryByText("Opportunity")).not.toBeInTheDocument();

    rerender(
      <AuthProvider>
        <MemoryRouter initialEntries={["/opportunities/5"]}>
          <CrumbLabelProvider>
            <AppBreadcrumbs />
          </CrumbLabelProvider>
        </MemoryRouter>
      </AuthProvider>,
    );
    expect(screen.getByText("Opportunity")).toBeInTheDocument();
  });

  it("updates when the name changes and ignores an empty one", () => {
    const { rerender } = renderTrail(
      "/opportunities/5",
      <Page label="Old name" />,
    );
    expect(screen.getByText("Old name")).toBeInTheDocument();
    rerender(
      <AuthProvider>
        <MemoryRouter initialEntries={["/opportunities/5"]}>
          <CrumbLabelProvider>
            <AppBreadcrumbs />
            <Page label="New name" />
          </CrumbLabelProvider>
        </MemoryRouter>
      </AuthProvider>,
    );
    expect(screen.getByText("New name")).toBeInTheDocument();
  });

  it("links an earlier crumb with its real name on a deeper page", () => {
    renderTrail(
      "/opportunities/5/versions/9",
      <Page label="Regional Delivery Fleet" />,
    );
    expect(
      screen.getByRole("link", { name: "Regional Delivery Fleet" }),
    ).toHaveAttribute("href", "/opportunities/5");
  });

  it("names the opportunity crumb from the API, and quietly keeps the generic one if that fails", async () => {
    vi.mocked(api.fetchOpportunity).mockResolvedValue({
      id: 5,
      title: "Fetched Deal",
    } as api.Opportunity);
    renderTrail("/opportunities/5/versions/9", <Named id={5} />);
    expect(
      await screen.findByRole("link", { name: "Fetched Deal" }),
    ).toBeInTheDocument();
  });

  it("keeps the generic crumb when the lookup fails", async () => {
    vi.mocked(api.fetchOpportunity).mockRejectedValue(new Error("down"));
    renderTrail("/opportunities/5/versions/9", <Named id={5} />);
    await vi.waitFor(() => expect(api.fetchOpportunity).toHaveBeenCalled());
    expect(
      screen.getByRole("link", { name: "Opportunity" }),
    ).toBeInTheDocument();
  });
});
