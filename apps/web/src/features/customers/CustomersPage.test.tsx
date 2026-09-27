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
};

const harbor: api.Customer = {
  id: 11,
  organization_id: 1,
  name: "Harbor Freight Co",
  industry: null,
  status: "active",
};

function renderAuthenticated(me: api.Me = managerMe) {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("CustomersPage", () => {
  it("lists customers with edit and delete actions for a manager", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda, harbor]);

    renderAuthenticated();

    expect(
      await screen.findByRole("cell", { name: "Lombarda Studio Group" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Professional Services" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "—" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Harbor Freight Co" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New customer" }),
    ).toBeInTheDocument();
  });

  it("is read-only for a viewer", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);

    renderAuthenticated({ ...managerMe, role: "viewer" });

    expect(
      await screen.findByRole("cell", { name: "Lombarda Studio Group" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New customer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit|Delete/ }),
    ).not.toBeInTheDocument();
  });

  it("searches on the server after the user stops typing", async () => {
    vi.mocked(api.fetchCustomers).mockImplementation(async (_token, query) =>
      query ? [] : [lombarda],
    );

    renderAuthenticated();
    await screen.findByRole("cell", { name: "Lombarda Studio Group" });

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search customers" }),
      {
        target: { value: " zzz " },
      },
    );

    expect(
      await screen.findByText("No customers match “zzz”."),
    ).toBeInTheDocument();
    expect(api.fetchCustomers).toHaveBeenLastCalledWith("stored-token", "zzz");
    expect(
      screen.queryByRole("button", { name: "Add your first customer" }),
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

  it("creates a customer and refreshes the list", async () => {
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
      await screen.findByRole("cell", { name: "Harbor Freight Co" }),
    ).toBeInTheDocument();
    expect(api.createCustomer).toHaveBeenCalledWith("stored-token", {
      name: "Harbor Freight Co",
      industry: null,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits a customer starting from its current values", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);
    vi.mocked(api.updateCustomer).mockResolvedValue({
      ...lombarda,
      industry: "Media",
    });

    renderAuthenticated();

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Lombarda Studio Group" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit customer" });
    expect(within(dialog).getByLabelText("Customer name")).toHaveValue(
      "Lombarda Studio Group",
    );
    fireEvent.change(within(dialog).getByLabelText(/Industry/), {
      target: { value: "Media" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(api.updateCustomer).toHaveBeenCalledWith("stored-token", 10, {
        name: "Lombarda Studio Group",
        industry: "Media",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("keeps the form open with the error when saving fails", async () => {
    vi.mocked(api.fetchCustomers).mockResolvedValue([lombarda]);
    vi.mocked(api.updateCustomer).mockRejectedValue(
      new ApiError(404, "Failed", "Not found"),
    );

    renderAuthenticated();

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Lombarda Studio Group" }),
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

  it("deletes a customer after confirmation", async () => {
    vi.mocked(api.fetchCustomers)
      .mockResolvedValueOnce([lombarda, harbor])
      .mockResolvedValue([lombarda]);
    vi.mocked(api.deleteCustomer).mockResolvedValue(undefined);

    renderAuthenticated();

    fireEvent.click(
      await screen.findByRole("button", { name: "Delete Harbor Freight Co" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete Harbor Freight Co?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete customer" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("cell", { name: "Harbor Freight Co" }),
      ).not.toBeInTheDocument(),
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

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Delete Lombarda Studio Group",
      }),
    );
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
      await screen.findByRole("cell", { name: "Lombarda Studio Group" }),
    ).toBeInTheDocument();
  });
});
