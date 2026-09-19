import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "./Header";

describe("Header", () => {
  it("displays the organization name and a human-readable role label", () => {
    render(
      <Header
        organizationName="Northstar Mobility Advisory"
        role="proposal_manager"
        onLogout={() => {}}
      />,
    );

    expect(screen.getByText("Northstar Mobility Advisory")).toBeInTheDocument();
    expect(screen.getByText("Proposal Manager")).toBeInTheDocument();
  });

  it("calls onLogout when the logout button is clicked", () => {
    const onLogout = vi.fn();
    render(
      <Header
        organizationName="Northstar Mobility Advisory"
        role="admin"
        onLogout={onLogout}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(onLogout).toHaveBeenCalled();
  });
});
