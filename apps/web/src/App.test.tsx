import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import * as api from "./lib/api";

vi.mock("./lib/api");

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("App", () => {
  it("shows the demo login screen when there is no active session", async () => {
    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByText("Sign in as a demo user to continue"),
      ).toBeInTheDocument(),
    );
  });

  it("shows the dashboard with the organization and role once authenticated", async () => {
    localStorage.setItem("quotedrive.token", "stored-token");
    vi.mocked(api.fetchMe).mockResolvedValue({
      user: { id: 1, email: "admin@northstar.example", display_name: "Admin" },
      organization: {
        id: 1,
        name: "Northstar Mobility Advisory",
        slug: "northstar",
      },
      role: "admin",
    });

    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByText("Northstar Mobility Advisory"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });
});
