import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { ApiError } from "../../lib/errors";
import { AiSettingsPanel } from "./AiSettingsPanel";

vi.mock("../../lib/api");

const adminMe: api.Me = {
  user: { id: 1, email: "admin@northstar.example", display_name: "Admin" },
  organization: { id: 1, name: "Northstar", slug: "northstar" },
  role: "admin",
};

function renderPanel() {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(adminMe);
  return render(
    <AuthProvider>
      <MemoryRouter>
        <AiSettingsPanel />
      </MemoryRouter>
    </AuthProvider>,
  );
}

const SWITCH = {
  name: "Allow local fallback (Ollama) when OpenRouter is unavailable",
};

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("AiSettingsPanel", () => {
  it("turns the fallback on", async () => {
    vi.mocked(api.fetchOrganizationSettings).mockResolvedValue({
      ai_fallback_enabled: false,
      ai_fallback_available: true,
    });
    vi.mocked(api.updateOrganizationSettings).mockResolvedValue({
      ai_fallback_enabled: true,
      ai_fallback_available: true,
    });

    renderPanel();

    const toggle = await screen.findByRole("switch", SWITCH);
    expect(toggle).not.toBeChecked();
    expect(
      screen.queryByText(/no fallback provider configured/),
    ).not.toBeInTheDocument();
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toBeChecked());
    expect(api.updateOrganizationSettings).toHaveBeenCalledWith(
      "stored-token",
      { ai_fallback_enabled: true },
    );
  });

  it("says when the deployment has no fallback configured", async () => {
    vi.mocked(api.fetchOrganizationSettings).mockResolvedValue({
      ai_fallback_enabled: false,
      ai_fallback_available: false,
    });

    renderPanel();

    expect(
      await screen.findByText(/no fallback provider configured/),
    ).toBeInTheDocument();
  });

  it("keeps the old value and explains when saving fails", async () => {
    vi.mocked(api.fetchOrganizationSettings).mockResolvedValue({
      ai_fallback_enabled: true,
      ai_fallback_available: true,
    });
    vi.mocked(api.updateOrganizationSettings).mockRejectedValue(
      new ApiError(500, "Failed", null),
    );

    renderPanel();

    const toggle = await screen.findByRole("switch", SWITCH);
    fireEvent.click(toggle);

    expect(
      await screen.findByText("Couldn't change AI settings."),
    ).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it("offers a retry when loading fails", async () => {
    vi.mocked(api.fetchOrganizationSettings)
      .mockRejectedValueOnce(new ApiError(500, "Failed", null))
      .mockResolvedValue({
        ai_fallback_enabled: false,
        ai_fallback_available: true,
      });

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("switch", SWITCH)).toBeInTheDocument();
  });
});
