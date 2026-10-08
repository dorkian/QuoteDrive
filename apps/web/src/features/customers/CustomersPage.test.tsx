import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { ApiError } from "../../lib/errors";
import { CustomersPage } from "./CustomersPage";

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

const lombarda: api.Customer = {
  id: 10,
  organization_id: 1,
  name: "Lombarda Studio Group",
  industry: "Professional Services",
  status: "active",
  opportunity_count: 3,
  open_opportunities: 2,
  open_pipeline_value: "7528.00",
};

const harbor: api.Customer = {
  id: 11,
  organization_id: 1,
  name: "Harbor Freight Co",
  industry: null,
  status: "active",
  opportunity_count: 0,
  open_opportunities: 0,
  open_pipeline_value: "0",
};

// What the form sends for the profile when none of it is filled in.
const EMPTY_PROFILE = {
  industry_tags: null,
  website: null,
  hq_city: null,
  hq_country: null,
  company_size: null,
  about: null,
  contact_name: null,
  contact_title: null,
  contact_email: null,
};

const deal: api.Opportunity = {
  id: 7,
  organization_id: 1,
  customer_id: 10,
  owner_id: 1,
  title: "2026 Fleet Modernization",
  status: "open",
  brief_json: null,
  last_activity_at: "2026-09-20T10:00:00Z",
  latest_version: {
    id: 3,
    version_number: 1,
    status: "awaiting_approval",
    total_estimate: "7528.00",
  },
};

function renderAuthenticated(me: api.Me = managerMe, path = "/customers") {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <CustomersPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

/** Opens a customer's side panel from its row. */
async function openPanel(name: string) {
  fireEvent.click(await screen.findByRole("button", { name: `View ${name}` }));
  return screen.findByRole("dialog", { name });
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(api.fetchOpportunities).mockResolvedValue([]);
});

describe("CustomersPage", () => {
  it("lists customers with their pipeline for a manager", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda, harbor]);

    renderAuthenticated();

    expect(
      await screen.findByText("Lombarda Studio Group"),
    ).toBeInTheDocument();
    expect(screen.getByText("Professional Services")).toBeInTheDocument();
    expect(screen.getByText("No industry set")).toBeInTheDocument();
    expect(screen.getByText("$7,528/mo")).toBeInTheDocument();
    expect(screen.getByText("(2 open)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View Harbor Freight Co" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New customer" }),
    ).toBeInTheDocument();
  });

  it("searches name and industry, and filters by status, in the browser", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([
      lombarda,
      { ...harbor, status: "inactive" },
    ]);

    renderAuthenticated();
    await screen.findByText("Lombarda Studio Group");
    expect(
      screen.getByRole("button", { name: /^Inactive 1/ }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search customers" }),
      { target: { value: "professional" } },
    );
    expect(screen.queryByText("Harbor Freight Co")).not.toBeInTheDocument();
    expect(screen.getByText("Lombarda Studio Group")).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search customers" }),
      { target: { value: "" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^Inactive/ }));
    expect(screen.queryByText("Lombarda Studio Group")).not.toBeInTheDocument();
    expect(screen.getByText("Harbor Freight Co")).toBeInTheDocument();
    expect(api.fetchCustomers).toHaveBeenCalledTimes(1); // no server round-trip per keystroke
  });

  it("opens a customer modal with their opportunities", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);
    vi.mocked(api.fetchOpportunities).mockResolvedValue([deal]);

    renderAuthenticated();

    const modal = await openPanel("Lombarda Studio Group");
    expect(api.fetchOpportunities).toHaveBeenCalledWith("stored-token", 10);
    expect(within(modal).getByText("$7,528")).toBeInTheDocument();
    expect(
      await within(modal).findByRole("button", {
        name: /2026 Fleet Modernization/,
      }),
    ).toBeInTheDocument();
    // A centred modal, not the side panel used for opportunities.
    expect(modal).toHaveAttribute("data-slot", "customer-modal");
  });

  it("opens an opportunity on top of the customer without leaving the page", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);
    vi.mocked(api.fetchOpportunities).mockResolvedValue([deal]);
    vi.mocked(api.fetchOpportunity).mockResolvedValue(deal);
    vi.mocked(api.fetchProposalVersions).mockResolvedValue([]);
    vi.mocked(api.fetchCustomer).mockResolvedValue(lombarda);
    vi.mocked(api.fetchAuditEvents).mockResolvedValue([]);

    renderAuthenticated();

    const modal = await openPanel("Lombarda Studio Group");
    fireEvent.click(
      await within(modal).findByRole("button", {
        name: /2026 Fleet Modernization/,
      }),
    );

    const panel = await screen.findByRole("dialog", {
      name: "2026 Fleet Modernization",
    });
    expect(panel).toHaveAttribute("data-slot", "entity-panel");
    // Still the Customers page, and the customer is still open underneath.
    expect(
      screen.getByRole("heading", { name: "Customers", hidden: true }),
    ).toBeInTheDocument();
    const modalNow = document.querySelector('[data-slot="customer-modal"]');
    expect(modalNow).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Close panel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "2026 Fleet Modernization" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole("dialog", { name: "Lombarda Studio Group" }),
    ).toBeInTheDocument();
  });

  it("reopens the panel from a shared link", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);

    renderAuthenticated(managerMe, "/customers?open=10");

    expect(
      await screen.findByRole("dialog", { name: "Lombarda Studio Group" }),
    ).toBeInTheDocument();
  });

  it("is read-only for a viewer", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);

    renderAuthenticated({ ...managerMe, role: "viewer" });

    const panel = await openPanel("Lombarda Studio Group");
    expect(
      screen.queryByRole("button", { name: "New customer" }),
    ).not.toBeInTheDocument();
    expect(
      within(panel).queryByRole("button", { name: /Edit customer|Delete/ }),
    ).not.toBeInTheDocument();
  });

  it("offers to add the first customer when there are none", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([]);

    renderAuthenticated();

    fireEvent.click(
      await screen.findByRole("button", { name: "Add your first customer" }),
    );
    expect(
      screen.getByRole("dialog", { name: "New customer" }),
    ).toBeInTheDocument();
  });

  it("creates a customer and opens it in the panel", async () => {
    vi.mocked(api.fetchCustomers)
      .mockResolvedValueOnce([lombarda])
      .mockResolvedValue([lombarda, harbor]);
    vi.mocked(api.createCustomer).mockResolvedValue(harbor);

    renderAuthenticated();

    fireEvent.click(
      await screen.findByRole("button", { name: "New customer" }),
    );
    const dialog = screen.getByRole("dialog", { name: "New customer" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create customer" }),
    );
    expect(
      within(dialog).getByText("Enter a customer name."),
    ).toBeInTheDocument();
    expect(api.createCustomer).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Customer name"), {
      target: { value: "  Harbor Freight Co " },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create customer" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Harbor Freight Co" }),
    ).toBeInTheDocument();
    expect(api.createCustomer).toHaveBeenCalledWith("stored-token", {
      ...EMPTY_PROFILE,
      name: "Harbor Freight Co",
      industry: null,
    });
    expect(
      screen.queryByRole("dialog", { name: "New customer" }),
    ).not.toBeInTheDocument();
  });

  it("edits a customer from the panel, starting from its current values", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);
    vi.mocked(api.updateCustomer).mockResolvedValue({
      ...lombarda,
      industry: "Media",
    });

    renderAuthenticated();

    const panel = await openPanel("Lombarda Studio Group");
    fireEvent.click(
      within(panel).getByRole("button", { name: "Edit customer" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit customer" });
    expect(within(dialog).getByLabelText("Customer name")).toHaveValue(
      "Lombarda Studio Group",
    );
    fireEvent.change(within(dialog).getByLabelText("Industry (optional)"), {
      target: { value: "Media" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(api.updateCustomer).toHaveBeenCalledWith("stored-token", 10, {
        ...EMPTY_PROFILE,
        name: "Lombarda Studio Group",
        industry: "Media",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Edit customer" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps the form open with the error when saving fails", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);
    vi.mocked(api.updateCustomer).mockRejectedValue(
      new ApiError(404, "Failed", "Not found"),
    );

    renderAuthenticated();

    const panel = await openPanel("Lombarda Studio Group");
    fireEvent.click(
      within(panel).getByRole("button", { name: "Edit customer" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit customer" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    expect(
      await within(dialog).findByText(
        "This customer doesn't exist or isn't in your organization.",
      ),
    ).toBeInTheDocument();
  });

  it("deletes a customer from the panel after confirmation", async () => {
    vi.mocked(api.fetchCustomers)
      .mockResolvedValueOnce([lombarda, harbor])
      .mockResolvedValue([lombarda]);
    vi.mocked(api.deleteCustomer).mockResolvedValue(undefined);

    renderAuthenticated();

    const panel = await openPanel("Harbor Freight Co");
    fireEvent.click(within(panel).getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete Harbor Freight Co?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete customer" }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Harbor Freight Co")).not.toBeInTheDocument(),
    );
    expect(api.deleteCustomer).toHaveBeenCalledWith("stored-token", 11);
  });

  it("explains why a customer with opportunities can't be deleted", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);
    vi.mocked(api.deleteCustomer).mockRejectedValue(
      new ApiError(
        409,
        "Failed",
        "Cannot delete customer with existing opportunities",
      ),
    );

    renderAuthenticated();

    const panel = await openPanel("Lombarda Studio Group");
    fireEvent.click(within(panel).getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete customer" }),
    );

    expect(
      await within(dialog).findByText(
        /Lombarda Studio Group still has opportunities, so it can't be deleted/,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Delete customer" }),
    ).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("shows a retryable error when loading fails", async () => {
    vi.mocked(api.fetchCustomers)
      .mockRejectedValueOnce(new ApiError(500, "Failed", null))
      .mockResolvedValue([lombarda]);

    renderAuthenticated();

    expect(
      await screen.findByText("Couldn't load customers."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("Lombarda Studio Group"),
    ).toBeInTheDocument();
  });

  describe("customer profile", () => {
    const orchard: api.Customer = {
      id: 15,
      organization_id: 1,
      name: "Orchard Retail Collective",
      industry: "Retail",
      status: "active",
      website: "https://orchard-retail.example",
      hq_city: "Turin",
      hq_country: "Italy",
      company_size: "201-1000",
      about: "Regional grocery and home-delivery group.",
      industry_tags: ["Grocery", "Home delivery"],
      contact_name: "Giulia Rossi",
      contact_title: "Head of Operations",
      contact_email: "giulia.rossi@orchard-retail.example",
      opportunity_count: 1,
      open_opportunities: 1,
      open_pipeline_value: "6015.00",
    };

    it("shows the logo, location, size, tags and the whole profile in the modal", async () => {
      vi.mocked(api.fetchCustomers).mockResolvedValue([orchard]);

      renderAuthenticated();

      const modal = await openPanel("Orchard Retail Collective");
      expect(within(modal).getByText("Turin, Italy")).toBeInTheDocument();
      expect(within(modal).getByText("Grocery")).toBeInTheDocument();
      expect(within(modal).getByText("Home delivery")).toBeInTheDocument();
      expect(
        within(modal).getByText("Regional grocery and home-delivery group."),
      ).toBeInTheDocument();
      expect(
        within(modal).getAllByText("201-1000 people").length,
      ).toBeGreaterThan(0);
      expect(modal.querySelector("[data-logo]")).not.toBeNull();
      expect(within(modal).getByText("Giulia Rossi")).toBeInTheDocument();
      expect(within(modal).getByText("Head of Operations")).toBeInTheDocument();
    });

    it("opens the website safely in a new tab and offers to email the contact", async () => {
      vi.mocked(api.fetchCustomers).mockResolvedValue([orchard]);

      renderAuthenticated();

      const modal = await openPanel("Orchard Retail Collective");
      const site = within(modal).getByRole("link", {
        name: /orchard-retail\.example/,
      });
      expect(site).toHaveAttribute("href", "https://orchard-retail.example");
      expect(site).toHaveAttribute("target", "_blank");
      expect(site).toHaveAttribute("rel", "noopener noreferrer");
      expect(
        within(modal).getByRole("link", { name: /Email/ }),
      ).toHaveAttribute("href", "mailto:giulia.rossi@orchard-retail.example");
    });

    it("never renders a non-web address as a link", async () => {
      vi.mocked(api.fetchCustomers).mockResolvedValue([
        { ...orchard, website: "javascript:alert(1)" },
      ]);

      renderAuthenticated();

      const modal = await openPanel("Orchard Retail Collective");
      expect(
        within(modal).queryByRole("link", { name: /alert/ }),
      ).not.toBeInTheDocument();
      expect(modal.querySelector('a[href^="javascript"]')).toBeNull();
    });

    it("copies the contact's email", async () => {
      vi.mocked(api.fetchCustomers).mockResolvedValue([orchard]);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      renderAuthenticated();

      const modal = await openPanel("Orchard Retail Collective");
      fireEvent.click(
        within(modal).getByRole("button", { name: /Copy giulia/ }),
      );

      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          "giulia.rossi@orchard-retail.example",
        ),
      );
      expect(await within(modal).findByText("Copied")).toBeInTheDocument();
    });

    it("invites an editor to add details when the profile is empty", async () => {
      vi.mocked(api.fetchCustomers).mockResolvedValue([harbor]);

      renderAuthenticated();

      const modal = await openPanel("Harbor Freight Co");
      expect(
        within(modal).getByText("No profile details yet."),
      ).toBeInTheDocument();
      fireEvent.click(
        within(modal).getByRole("button", { name: "Add details" }),
      );
      expect(
        screen.getByRole("dialog", { name: "Edit customer" }),
      ).toBeInTheDocument();
    });

    it("does not nag a viewer to add details", async () => {
      vi.mocked(api.fetchCustomers).mockResolvedValue([harbor]);

      renderAuthenticated({ ...managerMe, role: "viewer" });

      const modal = await openPanel("Harbor Freight Co");
      expect(
        within(modal).queryByRole("button", { name: "Add details" }),
      ).not.toBeInTheDocument();
    });

    it("shows location and size in the table and searches the whole profile", async () => {
      vi.mocked(api.fetchCustomers).mockResolvedValue([orchard, lombarda]);

      renderAuthenticated();

      expect(
        await screen.findByText(/Retail · Turin, Italy/),
      ).toBeInTheDocument();
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search customers" }),
        { target: { value: "giulia" } },
      );
      expect(screen.getByText("Orchard Retail Collective")).toBeInTheDocument();
      expect(
        screen.queryByText("Lombarda Studio Group"),
      ).not.toBeInTheDocument();

      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search customers" }),
        { target: { value: "home delivery" } },
      );
      expect(screen.getByText("Orchard Retail Collective")).toBeInTheDocument();
    });

    it("saves every profile detail from the form", async () => {
      vi.mocked(api.fetchCustomers).mockResolvedValue([harbor]);
      vi.mocked(api.updateCustomer).mockResolvedValue({
        ...harbor,
        hq_city: "Genoa",
      });

      renderAuthenticated();

      const modal = await openPanel("Harbor Freight Co");
      fireEvent.click(
        within(modal).getByRole("button", { name: "Edit customer" }),
      );
      const dialog = screen.getByRole("dialog", { name: "Edit customer" });
      fireEvent.change(within(dialog).getByLabelText("Industry (optional)"), {
        target: { value: "Maritime" },
      });
      fireEvent.change(
        within(dialog).getByLabelText("Company size (optional)"),
        { target: { value: "51-200" } },
      );
      fireEvent.change(within(dialog).getByLabelText("Website (optional)"), {
        target: { value: "harbor.example" },
      });
      fireEvent.change(within(dialog).getByLabelText("City (optional)"), {
        target: { value: " Genoa " },
      });
      fireEvent.change(within(dialog).getByLabelText("Country (optional)"), {
        target: { value: "Italy" },
      });
      fireEvent.change(within(dialog).getByLabelText(/^About/), {
        target: { value: "Port hauliers." },
      });
      fireEvent.change(
        within(dialog).getByLabelText("Contact name (optional)"),
        { target: { value: "Marco Bellini" } },
      );
      fireEvent.change(within(dialog).getByLabelText("Job title (optional)"), {
        target: { value: "Transport Manager" },
      });
      fireEvent.change(
        within(dialog).getByLabelText("Contact email (optional)"),
        {
          target: { value: "marco@harbor.example" },
        },
      );
      const tags = within(dialog).getByLabelText("Industry tags (optional)");
      fireEvent.change(tags, { target: { value: "Haulage" } });
      fireEvent.keyDown(tags, { key: "Enter" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await waitFor(() =>
        expect(api.updateCustomer).toHaveBeenCalledWith("stored-token", 11, {
          name: "Harbor Freight Co",
          industry: "Maritime",
          industry_tags: ["Haulage"],
          website: "harbor.example",
          hq_city: "Genoa",
          hq_country: "Italy",
          company_size: "51-200",
          about: "Port hauliers.",
          contact_name: "Marco Bellini",
          contact_title: "Transport Manager",
          contact_email: "marco@harbor.example",
        }),
      );
    });

    it("blocks an invalid contact email before it is sent", async () => {
      vi.mocked(api.fetchCustomers).mockResolvedValue([harbor]);

      renderAuthenticated();

      const modal = await openPanel("Harbor Freight Co");
      fireEvent.click(
        within(modal).getByRole("button", { name: "Edit customer" }),
      );
      const dialog = screen.getByRole("dialog", { name: "Edit customer" });
      fireEvent.change(
        within(dialog).getByLabelText("Contact email (optional)"),
        { target: { value: "nope" } },
      );
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      expect(
        within(dialog).getByText("Enter a valid contact email."),
      ).toBeInTheDocument();
      expect(api.updateCustomer).not.toHaveBeenCalled();
    });
  });
});
