import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CommandMenu } from "./CommandMenu";
import type { NavItem } from "./nav-items";

function Harness({ onSelect }: { onSelect: (item: NavItem) => void }) {
  const [open, setOpen] = useState(false);
  return <CommandMenu open={open} onOpenChange={setOpen} onSelect={onSelect} />;
}

describe("CommandMenu", () => {
  it("opens on Ctrl+K and navigates to the chosen page", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    fireEvent.click(screen.getByRole("option", { name: "Opportunities" }));

    expect(onSelect).toHaveBeenCalledWith("Opportunities");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters pages by the typed query", () => {
    render(<Harness onSelect={() => {}} />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    fireEvent.change(screen.getByPlaceholderText("Go to…"), {
      target: { value: "appro" },
    });

    expect(
      screen.getByRole("option", { name: "Approvals" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Customers" }),
    ).not.toBeInTheDocument();
  });
});
