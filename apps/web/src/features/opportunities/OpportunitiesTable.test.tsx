import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { Customer, Opportunity } from "../../lib/api";
import { OpportunitiesTable, PAGE_SIZE } from "./OpportunitiesTable";

const customers: Customer[] = [
  {
    id: 1,
    organization_id: 1,
    name: "Alpine Logistics",
    industry: "Logistics",
    status: "active",
  },
  {
    id: 2,
    organization_id: 1,
    name: "Lombarda Studio Group",
    industry: "Services",
    status: "active",
  },
];

function opportunity(
  id: number,
  title: string,
  customer_id: number,
  status: string,
): Opportunity {
  return {
    id,
    organization_id: 1,
    customer_id,
    owner_id: 1,
    title,
    status,
    brief_json: null,
  };
}

const sample = [
  opportunity(1, "Charlie fleet refresh", 2, "open"),
  opportunity(2, "Alpha shuttle", 1, "won"),
  opportunity(3, "Bravo campus EV", 2, "open"),
];

function renderTable(opportunities = sample) {
  render(
    <MemoryRouter>
      <OpportunitiesTable opportunities={opportunities} customers={customers} />
    </MemoryRouter>,
  );
}

function titles() {
  return within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("link")
    .map((link) => link.textContent);
}

describe("OpportunitiesTable", () => {
  it("sorts by title ascending, then descending on a second click", () => {
    renderTable();
    expect(titles()).toEqual([
      "Alpha shuttle",
      "Bravo campus EV",
      "Charlie fleet refresh",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Opportunity" }));

    expect(titles()).toEqual([
      "Charlie fleet refresh",
      "Bravo campus EV",
      "Alpha shuttle",
    ]);
    expect(
      screen.getByRole("columnheader", { name: "Opportunity" }),
    ).toHaveAttribute("aria-sort", "descending");
  });

  it("filters by search text across title and customer", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Search opportunities"), {
      target: { value: "alpine" },
    });
    expect(titles()).toEqual(["Alpha shuttle"]);
    expect(screen.getByText("1 of 3 opportunities")).toBeInTheDocument();
  });

  it("filters by status and shows a no-match row", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Filter by status"), {
      target: { value: "won" },
    });
    expect(titles()).toEqual(["Alpha shuttle"]);

    fireEvent.change(screen.getByLabelText("Search opportunities"), {
      target: { value: "bravo" },
    });
    expect(
      screen.getByText("No opportunities match these filters."),
    ).toBeInTheDocument();
  });

  it("paginates beyond one page", () => {
    const many = Array.from({ length: PAGE_SIZE + 2 }, (_, i) =>
      opportunity(i + 1, `Deal ${String(i + 1).padStart(2, "0")}`, 1, "open"),
    );
    renderTable(many);

    expect(titles()).toHaveLength(PAGE_SIZE);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(titles()).toEqual(["Deal 11", "Deal 12"]);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
});
