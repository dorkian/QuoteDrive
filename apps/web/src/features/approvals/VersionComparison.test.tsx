import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProposalVersion } from "../../lib/api";
import { computeLineDiff } from "./diff";
import { VersionComparison } from "./VersionComparison";

const v1: ProposalVersion = {
  id: 1,
  organization_id: 1,
  opportunity_id: 1,
  version_number: 1,
  status: "awaiting_approval",
  content_json: {
    lines: [
      {
        catalogue_item_id: 10,
        name: "Electric Sedan",
        category: "electric",
        quantity: 2,
        add_on_item_ids: [101],
        unit_estimate: "500.00",
        line_total: "1000.00",
        assumptions: "10,000 miles",
      },
      {
        catalogue_item_id: 20,
        name: "Maintenance Package",
        category: "maintenance",
        quantity: 1,
        add_on_item_ids: [],
        unit_estimate: "150.00",
        line_total: "150.00",
        assumptions: null,
      },
    ],
  },
  total_estimate: "1150.00",
  created_by: 1,
};

const v2: ProposalVersion = {
  id: 2,
  organization_id: 1,
  opportunity_id: 1,
  version_number: 2,
  status: "awaiting_approval",
  content_json: {
    lines: [
      {
        catalogue_item_id: 10,
        name: "Electric Sedan",
        category: "electric",
        quantity: 3, // quantity changed
        add_on_item_ids: [101],
        unit_estimate: "500.00",
        line_total: "1500.00",
        assumptions: "12,000 miles", // assumptions changed
      },
      {
        catalogue_item_id: 30, // added
        name: "Charging Station",
        category: "infrastructure",
        quantity: 1,
        add_on_item_ids: [],
        unit_estimate: "300.00",
        line_total: "300.00",
        assumptions: null,
      },
      // catalogue_item_id 20 is removed
    ],
  },
  total_estimate: "1800.00",
  created_by: 1,
};

describe("computeLineDiff", () => {
  it("correctly identifies added, removed, changed, and unchanged lines", () => {
    const diffs = computeLineDiff(v2, v1);

    const added = diffs.find((d) => d.catalogue_item_id === 30);
    expect(added).toBeDefined();
    expect(added?.status).toBe("added");
    expect(added?.name).toBe("Charging Station");

    const removed = diffs.find((d) => d.catalogue_item_id === 20);
    expect(removed).toBeDefined();
    expect(removed?.status).toBe("removed");
    expect(removed?.name).toBe("Maintenance Package");

    const changed = diffs.find((d) => d.catalogue_item_id === 10);
    expect(changed).toBeDefined();
    expect(changed?.status).toBe("changed");
    expect(changed?.changes).toContain("Quantity: 2 → 3");
    expect(changed?.changes).toContain(
      'Assumptions: "10,000 miles" → "12,000 miles"',
    );
  });

  it("identifies unchanged lines when attributes match", () => {
    const diffs = computeLineDiff(v1, v1);
    expect(diffs.every((d) => d.status === "unchanged")).toBe(true);
  });

  it("handles duplicate catalogue_item_id lines without collapsing", () => {
    const prevWithDups: ProposalVersion = {
      ...v1,
      content_json: {
        lines: [
          {
            catalogue_item_id: 10,
            name: "Electric Sedan (Dept A)",
            category: "electric",
            quantity: 2,
            add_on_item_ids: [],
            unit_estimate: "500.00",
            line_total: "1000.00",
            assumptions: null,
          },
          {
            catalogue_item_id: 10,
            name: "Electric Sedan (Dept B)",
            category: "electric",
            quantity: 4,
            add_on_item_ids: [],
            unit_estimate: "500.00",
            line_total: "2000.00",
            assumptions: null,
          },
        ],
      },
    };

    const currWithDups: ProposalVersion = {
      ...v2,
      content_json: {
        lines: [
          {
            catalogue_item_id: 10,
            name: "Electric Sedan (Dept A)",
            category: "electric",
            quantity: 3, // changed
            add_on_item_ids: [],
            unit_estimate: "500.00",
            line_total: "1500.00",
            assumptions: null,
          },
          {
            catalogue_item_id: 10,
            name: "Electric Sedan (Dept B)",
            category: "electric",
            quantity: 4, // unchanged
            add_on_item_ids: [],
            unit_estimate: "500.00",
            line_total: "2000.00",
            assumptions: null,
          },
        ],
      },
    };

    const diffs = computeLineDiff(currWithDups, prevWithDups);
    expect(diffs).toHaveLength(2);
    expect(diffs[0].status).toBe("changed");
    expect(diffs[1].status).toBe("unchanged");
  });

  it("detects price-only changes as changed", () => {
    const prevPrice: ProposalVersion = {
      ...v1,
      content_json: {
        lines: [
          {
            catalogue_item_id: 10,
            name: "Electric Sedan",
            category: "electric",
            quantity: 1,
            add_on_item_ids: [],
            unit_estimate: "500.00",
            line_total: "500.00",
            assumptions: null,
          },
        ],
      },
    };

    const currPrice: ProposalVersion = {
      ...v1,
      content_json: {
        lines: [
          {
            catalogue_item_id: 10,
            name: "Electric Sedan",
            category: "electric",
            quantity: 1,
            add_on_item_ids: [],
            unit_estimate: "550.00",
            line_total: "550.00",
            assumptions: null,
          },
        ],
      },
    };

    const diffs = computeLineDiff(currPrice, prevPrice);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe("changed");
    expect(diffs[0].changes).toContain("Unit estimate: $500.00 → $550.00");
    expect(diffs[0].changes).toContain("Line total: $500.00 → $550.00");
  });
});

describe("VersionComparison component", () => {
  it("renders first version message when previous is null", () => {
    render(<VersionComparison current={v1} previous={null} />);
    expect(
      screen.getByText("First version — no previous version to compare."),
    ).toBeInTheDocument();
  });

  it("renders comparison title, status badges, and delta when previous exists", () => {
    render(<VersionComparison current={v2} previous={v1} />);

    expect(
      screen.getByText("Comparison with Version 1"),
    ).toBeInTheDocument();
    expect(screen.getByText("+$650.00")).toBeInTheDocument();
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();
    expect(screen.getByText("Changed")).toBeInTheDocument();
  });

  it("formats decimal cents accurately without floating point artifacts", () => {
    const prev: ProposalVersion = { ...v1, total_estimate: "10.00" };
    const curr: ProposalVersion = { ...v1, total_estimate: "19.99" };
    render(<VersionComparison current={curr} previous={prev} />);
    expect(screen.getByText("+$9.99")).toBeInTheDocument();
  });
});
