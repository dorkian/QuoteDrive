import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PreviewNav } from "./PreviewNav";

function renderNav() {
  render(
    <MemoryRouter>
      <PreviewNav />
    </MemoryRouter>,
  );
}

describe("PreviewNav", () => {
  it("offers every section of the app, so the preview is never a dead end", () => {
    renderNav();
    const links: [string, string][] = [
      ["Dashboard", "/"],
      ["Customers", "/customers"],
      ["Opportunities", "/opportunities"],
      ["Proposals", "/proposals"],
      ["Approvals", "/approvals"],
      ["Settings", "/settings"],
    ];
    for (const [name, href] of links) {
      expect(screen.getByRole("link", { name }), name).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(
      screen.getByRole("link", { name: "QuoteDrive home" }),
    ).toHaveAttribute("href", "/");
  });

  it("disappears when printing", () => {
    renderNav();
    expect(
      screen.getByRole("navigation", { name: "Main" }).className,
    ).toContain("print:hidden");
  });
});
