import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HelpMenu } from "./HelpMenu";

const start = vi.fn();
const reset = vi.fn();

// The menu only wires three things together, so they are stubbed. Radix's dropdown is
// swapped for plain elements too: mounting its open menu under jsdom took 2 to 9 s per test
// and slowed each later test in the file (it dominated CI time). The menu itself is Radix's
// to test; what matters here is that each item calls the right thing.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: ReactNode;
    onSelect?: () => void;
  }) => (
    <button type="button" role="menuitem" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
}));
vi.mock("../../lib/auth-context", () => ({
  useAuth: () => ({ me: { user: { id: 7 } } }),
}));
vi.mock("../../features/onboarding/tour-context", () => ({
  useTour: () => ({ start, active: false }),
}));
vi.mock("../../features/onboarding/tips", () => ({
  resetTips: (id: number) => reset(id),
}));

beforeEach(() => {
  start.mockClear();
  reset.mockClear();
});

describe("HelpMenu", () => {
  it("is findable by name and marked as the tour's Help target", () => {
    render(<HelpMenu />);
    expect(
      screen.getByRole("button", { name: "Help and tour" }),
    ).toHaveAttribute("data-tour", "help");
  });

  it("replays the product tour", () => {
    render(<HelpMenu defaultOpen />);
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Take the product tour/ }),
    );
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("brings the tips back for the signed-in user", () => {
    render(<HelpMenu defaultOpen />);
    fireEvent.click(screen.getByRole("menuitem", { name: /Show tips again/ }));
    expect(reset).toHaveBeenCalledWith(7);
  });

  it("mentions the command menu shortcut", () => {
    render(<HelpMenu defaultOpen />);
    expect(screen.getByText(/Press ⌘K anywhere/)).toBeInTheDocument();
  });
});
