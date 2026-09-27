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
import { SettingsPage } from "./SettingsPage";

vi.mock("../../lib/api");

const adminMe: api.Me = {
  user: {
    id: 1,
    email: "admin@northstar.example",
    display_name: "Avery Admin",
  },
  organization: {
    id: 1,
    name: "Northstar Mobility Advisory",
    slug: "northstar",
  },
  role: "admin",
};

const admin: api.Member = {
  user_id: 1,
  email: "admin@northstar.example",
  display_name: "Avery Admin",
  role: "admin",
};
const viewer: api.Member = {
  user_id: 4,
  email: "viewer@northstar.example",
  display_name: "Vic Viewer",
  role: "viewer",
};

function renderAs(me: api.Me) {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("SettingsPage", () => {
  it("shows a role panel instead of settings for non-admins", async () => {
    renderAs({ ...adminMe, role: "proposal_manager" });

    expect(
      await screen.findByText(
        "Your role (Proposal Manager) can't change workspace settings.",
      ),
    ).toBeInTheDocument();
    expect(api.fetchMembers).not.toHaveBeenCalled();
  });

  it("lists members and locks the only Admin", async () => {
    vi.mocked(api.fetchMembers).mockResolvedValue([admin, viewer]);

    renderAs(adminMe);

    const adminRole = await screen.findByRole("combobox", {
      name: "Role for Avery Admin",
    });
    expect(adminRole).toBeDisabled();
    expect(
      screen.getByText("The only Admin can't be changed."),
    ).toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Role for Vic Viewer" }),
    ).toHaveValue("viewer");
  });

  it("changes a role after confirmation", async () => {
    vi.mocked(api.fetchMembers).mockResolvedValue([admin, viewer]);
    vi.mocked(api.updateMemberRole).mockResolvedValue({
      ...viewer,
      role: "approver",
    });

    renderAs(adminMe);

    fireEvent.change(
      await screen.findByRole("combobox", { name: "Role for Vic Viewer" }),
      { target: { value: "approver" } },
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Make Vic Viewer Approver?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Change role" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Role for Vic Viewer" }),
      ).toHaveValue("approver"),
    );
    expect(api.updateMemberRole).toHaveBeenCalledWith(
      "stored-token",
      4,
      "approver",
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("leaves the role unchanged when the change is cancelled", async () => {
    vi.mocked(api.fetchMembers).mockResolvedValue([admin, viewer]);

    renderAs(adminMe);

    fireEvent.change(
      await screen.findByRole("combobox", { name: "Role for Vic Viewer" }),
      { target: { value: "admin" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("combobox", { name: "Role for Vic Viewer" }),
    ).toHaveValue("viewer");
    expect(api.updateMemberRole).not.toHaveBeenCalled();
  });

  it("warns and refreshes your own access when you step down", async () => {
    const secondAdmin = { ...viewer, role: "admin" as const };
    vi.mocked(api.fetchMembers).mockResolvedValue([admin, secondAdmin]);
    vi.mocked(api.updateMemberRole).mockResolvedValue({
      ...admin,
      role: "viewer",
    });

    renderAs(adminMe);

    fireEvent.change(
      await screen.findByRole("combobox", { name: "Role for Avery Admin" }),
      { target: { value: "viewer" } },
    );
    expect(
      screen.getByText("You'll lose access to Settings immediately."),
    ).toBeInTheDocument();
    vi.mocked(api.fetchMe).mockResolvedValue({ ...adminMe, role: "viewer" });
    fireEvent.click(screen.getByRole("button", { name: "Change role" }));

    expect(
      await screen.findByText(
        "Your role (Viewer) can't change workspace settings.",
      ),
    ).toBeInTheDocument();
  });

  it("explains the last-Admin rule when the API rejects a demotion", async () => {
    const secondAdmin = { ...viewer, role: "admin" as const };
    vi.mocked(api.fetchMembers).mockResolvedValue([admin, secondAdmin]);
    vi.mocked(api.updateMemberRole).mockRejectedValue(
      new ApiError(
        400,
        "Failed",
        "Cannot remove the last Admin of the organization",
      ),
    );

    renderAs(adminMe);

    fireEvent.change(
      await screen.findByRole("combobox", { name: "Role for Vic Viewer" }),
      { target: { value: "viewer" } },
    );
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Change role" }),
    );

    expect(
      await within(dialog).findByText(
        "Cannot remove the last Admin of the organization. Make someone else an Admin first.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a retryable error when members fail to load", async () => {
    vi.mocked(api.fetchMembers)
      .mockRejectedValueOnce(new ApiError(500, "Failed", null))
      .mockResolvedValue([admin]);

    renderAs(adminMe);

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("combobox", { name: "Role for Avery Admin" }),
    ).toBeInTheDocument();
  });
});
