import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HelpMenu } from "./HelpMenu";

const start = vi.fn();
const reset = vi.fn();

// The menu only wires three things together, so they are stubbed: Radix's modal
// menu and the real auth provider don't cooperate under jsdom.
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
