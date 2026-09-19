import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NAV_ITEMS } from "./nav-items";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("renders all five nav items", () => {
    render(<Sidebar active="Dashboard" onSelect={() => {}} />);

    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("button", { name: item })).toBeInTheDocument();
    }
  });

  it("marks the active item with aria-current", () => {
    render(<Sidebar active="Customers" onSelect={() => {}} />);

    expect(screen.getByRole("button", { name: "Customers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "Dashboard" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("calls onSelect with the clicked item", () => {
    const onSelect = vi.fn();
    render(<Sidebar active="Dashboard" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Opportunities" }));

    expect(onSelect).toHaveBeenCalledWith("Opportunities");
  });
});
