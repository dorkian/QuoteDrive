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
import { CataloguePanel } from "./CataloguePanel";

vi.mock("../../lib/api");

const adminMe: api.Me = {
  user: { id: 1, email: "admin@northstar.example", display_name: "Admin" },
  organization: { id: 1, name: "Northstar", slug: "northstar" },
  role: "admin",
};

const electric: api.CatalogueItem = {
  id: 1,
  organization_id: 1,
  type: "package",
  name: "Electric City",
  category: "electric_city",
  base_monthly_estimate: "649.00",
  active: true,
};
const charging: api.CatalogueItem = {
  id: 2,
  organization_id: 1,
  type: "add_on",
  name: "Home Charging",
  category: "charging",
  base_monthly_estimate: "45.00",
  active: true,
};
const retired: api.CatalogueItem = {
  id: 3,
  organization_id: 1,
  type: "package",
  name: "Diesel Estate",
  category: "legacy",
  base_monthly_estimate: "399.00",
  active: false,
};

function renderPanel() {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(adminMe);
  return render(
    <AuthProvider>
      <MemoryRouter>
        <CataloguePanel />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(api.fetchCatalogueItems).mockResolvedValue([
    charging,
    electric,
    retired,
  ]);
});

describe("CataloguePanel", () => {
  it("lists active items, packages first, and reveals inactive on request", async () => {
    renderPanel();

    const rows = await screen.findAllByRole("row");
    expect(
      rows.slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent),
    ).toEqual(["Electric CityPackage", "Home ChargingAdd-on"]);
    expect(api.fetchCatalogueItems).toHaveBeenCalledWith("stored-token", {
      includeInactive: true,
    });

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Show inactive items/ }),
    );
    expect(
      screen.getByRole("cell", { name: /^Diesel Estate/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("validates and creates an item", async () => {
    vi.mocked(api.createCatalogueItem).mockResolvedValue({
      ...electric,
      id: 9,
      type: "add_on",
      name: "Winter Tyres",
      category: "tyres",
      base_monthly_estimate: "19.50",
    });

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "New item" }));
    const dialog = screen.getByRole("dialog", { name: "New catalogue item" });
    fireEvent.change(within(dialog).getByLabelText("Type"), {
      target: { value: "add_on" },
    });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Winter Tyres" },
    });
    fireEvent.change(within(dialog).getByLabelText("Category"), {
      target: { value: "tyres" },
    });
    fireEvent.change(within(dialog).getByLabelText("Monthly price ($)"), {
      target: { value: "-4" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create item" }),
    );
    expect(
      within(dialog).getByText(
        "Enter a monthly price of 0 or more, with at most two decimals.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Monthly price ($)"), {
      target: { value: "19.50" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create item" }),
    );

    expect(
      await screen.findByRole("cell", { name: /^Winter Tyres/ }),
    ).toBeInTheDocument();
    expect(api.createCatalogueItem).toHaveBeenCalledWith("stored-token", {
      type: "add_on",
      name: "Winter Tyres",
      category: "tyres",
      base_monthly_estimate: "19.50",
      active: true,
    });
  });

  it("requires a name and a category", async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "New item" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create item" }),
    );
    expect(within(dialog).getByText("Enter a name.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "X" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create item" }),
    );
    expect(within(dialog).getByText("Enter a category.")).toBeInTheDocument();
    expect(api.createCatalogueItem).not.toHaveBeenCalled();
  });

  it("edits an item without sending its type or status", async () => {
    vi.mocked(api.updateCatalogueItem).mockResolvedValue({
      ...electric,
      base_monthly_estimate: "679.00",
    });

    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Electric City" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit Electric City" });
    expect(within(dialog).queryByLabelText("Type")).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Monthly price ($)"), {
      target: { value: "679.00" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    expect(await screen.findByText("$679.00")).toBeInTheDocument();
    expect(api.updateCatalogueItem).toHaveBeenCalledWith("stored-token", 1, {
      name: "Electric City",
      category: "electric_city",
      base_monthly_estimate: "679.00",
    });
  });

  it("shows the API error inside the edit dialog", async () => {
    vi.mocked(api.updateCatalogueItem).mockRejectedValue(
      new ApiError(404, "Failed", "Not found"),
    );

    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Electric City" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    expect(
      await within(dialog).findByText(
        "This catalogue item doesn't exist or isn't in your organization.",
      ),
    ).toBeInTheDocument();
  });

  it("deactivates an item after confirmation", async () => {
    vi.mocked(api.updateCatalogueItem).mockResolvedValue({
      ...electric,
      active: false,
    });

    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: "Deactivate Electric City" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Deactivate Electric City?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Deactivate item" }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Electric City")).not.toBeInTheDocument(),
    );
    expect(api.updateCatalogueItem).toHaveBeenCalledWith("stored-token", 1, {
      active: false,
    });
  });

  it("reactivates an inactive item and reports failures", async () => {
    vi.mocked(api.updateCatalogueItem)
      .mockRejectedValueOnce(new ApiError(500, "Failed", null))
      .mockResolvedValue({ ...retired, active: true });

    renderPanel();

    fireEvent.click(
      await screen.findByRole("checkbox", { name: /Show inactive items/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reactivate Diesel Estate" }),
    );
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reactivate item" }),
    );
    expect(
      await within(dialog).findByText("Couldn't change this item."),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reactivate item" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText("Active")).toHaveLength(3);
  });

  it("shows a retryable error when the catalogue fails to load", async () => {
    vi.mocked(api.fetchCatalogueItems)
      .mockRejectedValueOnce(new ApiError(500, "Failed", null))
      .mockResolvedValue([electric]);

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("cell", { name: /^Electric City/ }),
    ).toBeInTheDocument();
  });
});
