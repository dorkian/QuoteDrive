import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_META, statusMeta } from "./status-meta";

describe("status system", () => {
  it("gives every status a label, a colour, an icon and a hint", () => {
    for (const [status, meta] of Object.entries(STATUS_META)) {
      expect(meta.label, status).toBeTruthy();
      expect(meta.color, status).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.icon, status).toBeDefined();
      expect(meta.hint, status).toBeTruthy();
    }
  });

  it("keeps the statuses people compare visually distinct", () => {
    const colour = (s: string) => statusMeta(s).color;
    // Won, lost, expired, awaiting approval and open must never share a colour.
    const distinct = new Set(
      [
        "won",
        "lost",
        "expired",
        "awaiting_approval",
        "open",
        "changes_requested",
      ].map(colour),
    );
    expect(distinct.size).toBe(6);
  });

  it("falls back gracefully for a status it doesn't know", () => {
    expect(statusMeta("on_hold").label).toBe("On hold");
  });

  it("renders a pill with a text label and an explanatory tooltip, never colour alone", () => {
    render(<StatusBadge status="awaiting_approval" />);
    const pill = screen.getByText("Awaiting approval");
    expect(pill).toHaveAttribute("title", "Waiting for an approver");
    expect(pill.querySelector("svg")).not.toBeNull();
  });

  it("can drop the tooltip", () => {
    render(<StatusBadge status="won" showHint={false} />);
    expect(screen.getByText("Won")).not.toHaveAttribute("title");
  });
});

describe("Avatar", () => {
  it("shows initials and keeps the same tint for the same name", () => {
    const { container, rerender } = render(
      <Avatar name="Orchard Retail Collective" />,
    );
    expect(container).toHaveTextContent("OR");
    const first = container.querySelector("span")!.getAttribute("style");
    rerender(<Avatar name="Orchard Retail Collective" size="lg" />);
    expect(container.querySelector("span")!.getAttribute("style")).toBe(first);
  });

  it("copes with one-word and punctuated names", () => {
    const { container } = render(<Avatar name="Quarry & Co" size="sm" />);
    expect(container).toHaveTextContent("Q&");
    const single = render(<Avatar name="Acme" />);
    expect(single.container).toHaveTextContent("AC");
  });

  it("is decorative: the name beside it carries the meaning", () => {
    const { container } = render(<Avatar name="Pat Lee" />);
    expect(container.querySelector("span")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
