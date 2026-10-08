import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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
  extra: Partial<Opportunity> = {},
): Opportunity {
  return {
    id,
    organization_id: 1,
    customer_id,
    owner_id: 1,
    title,
    status,
    brief_json: null,
    owner_name: "Proposal Manager",
    version_count: 0,
    latest_version: null,
    ...extra,
  };
}

const sample = [
  opportunity(1, "Charlie fleet refresh", 2, "open", {
    last_activity_at: "2026-09-20T10:00:00Z",
    latest_version: {
      id: 11,
      version_number: 2,
      status: "awaiting_approval",
      total_estimate: "6015.00",
    },
  }),
  opportunity(2, "Alpha shuttle", 1, "won", {
    last_activity_at: "2026-09-25T10:00:00Z",
    latest_version: {
      id: 12,
      version_number: 1,
      status: "won",
      total_estimate: "7528.00",
    },
  }),
  opportunity(3, "Bravo campus EV", 2, "open", {
    last_activity_at: "2026-09-22T10:00:00Z",
  }),
];

function renderTable(
  opportunities = sample,
  onOpen = vi.fn(),
  selectedId: number | null = null,
) {
  render(
    <MemoryRouter>
      <OpportunitiesTable
        opportunities={opportunities}
        customers={customers}
        onOpen={onOpen}
        selectedId={selectedId}
      />
    </MemoryRouter>,
  );
  return onOpen;
}

/** Row titles in the order shown, read from each row's View button. */
function titles(): string[] {
  const body = screen.getAllByRole("rowgroup")[1];
  return within(body)
    .getAllByRole("button", { name: /^View / })
    .map((b) => b.getAttribute("aria-label")!.replace(/^View /, ""));
}

describe("OpportunitiesTable", () => {
  it("shows the most recently active opportunity first", () => {
    renderTable();
    expect(titles()).toEqual([
      "Alpha shuttle",
      "Bravo campus EV",
      "Charlie fleet refresh",
    ]);
  });

  it("sorts by title ascending, then descending on a second click", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: /^Opportunity/ }));
    expect(titles()).toEqual([
      "Alpha shuttle",
      "Bravo campus EV",
      "Charlie fleet refresh",
    ]);
    expect(
      screen.getByRole("columnheader", { name: /Opportunity/ }),
    ).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: /^Opportunity/ }));
    expect(titles()).toEqual([
      "Charlie fleet refresh",
      "Bravo campus EV",
      "Alpha shuttle",
    ]);
    expect(
      screen.getByRole("columnheader", { name: /Opportunity/ }),
    ).toHaveAttribute("aria-sort", "descending");
  });

  it("sorts by monthly estimate", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: /Monthly estimate/ }));
    // Ascending: no proposal (0), then 6,015, then 7,528.
    expect(titles()).toEqual([
      "Bravo campus EV",
      "Charlie fleet refresh",
      "Alpha shuttle",
    ]);
  });

  it("filters by search text across title, customer and owner", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Search opportunities"), {
      target: { value: "alpine" },
    });
    expect(titles()).toEqual(["Alpha shuttle"]);
    expect(
      screen.getByText(/Showing 1–1 of 1 opportunities \(3 total\)/),
    ).toBeInTheDocument();
  });

  it("filters with chips that show their counts", () => {
    renderTable();
    expect(screen.getByRole("button", { name: /^All 3/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Open 2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Won 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Lost 0/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Won/ }));
    expect(titles()).toEqual(["Alpha shuttle"]);

    fireEvent.change(screen.getByLabelText("Search opportunities"), {
      target: { value: "bravo" },
    });
    expect(
      screen.getByText("No opportunities match these filters."),
    ).toBeInTheDocument();
  });

  it("surfaces deals waiting on someone under Needs attention", () => {
    renderTable();
    expect(
      screen.getByRole("button", { name: /^Needs attention 1/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Needs attention/ }));
    expect(titles()).toEqual(["Charlie fleet refresh"]);
  });

  it("shows status, latest proposal and value with colour-independent labels", () => {
    renderTable();
    const row = screen
      .getByRole("button", { name: "View Charlie fleet refresh" })
      .closest("tr")!;
    expect(within(row).getByText("Open")).toBeInTheDocument();
    expect(within(row).getByText("Awaiting approval")).toBeInTheDocument();
    expect(within(row).getByText("v2")).toBeInTheDocument();
    expect(within(row).getByText("$6,015")).toBeInTheDocument();
    expect(within(row).getByText("Lombarda Studio Group")).toBeInTheDocument();
  });

  it("opens an opportunity from its row and from its View button", () => {
    const onOpen = renderTable();

    fireEvent.click(screen.getByText("Bravo campus EV"));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ id: 3 }));

    fireEvent.click(screen.getByRole("button", { name: "View Alpha shuttle" }));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ id: 2 }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("marks the open row as selected", () => {
    renderTable(sample, vi.fn(), 3);
    const row = screen
      .getByRole("button", { name: "View Bravo campus EV" })
      .closest("tr")!;
    expect(row).toHaveAttribute("data-selected");
  });

  it("paginates beyond one page", () => {
    const many = Array.from({ length: PAGE_SIZE + 2 }, (_, i) =>
      opportunity(i + 1, `Deal ${String(i + 1).padStart(2, "0")}`, 1, "open"),
    );
    renderTable(many);
    fireEvent.click(screen.getByRole("button", { name: /^Opportunity/ }));

    expect(titles()).toHaveLength(PAGE_SIZE);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(
      screen.getByText(/Showing 1–10 of 12 opportunities/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(titles()).toEqual(["Deal 11", "Deal 12"]);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
});
