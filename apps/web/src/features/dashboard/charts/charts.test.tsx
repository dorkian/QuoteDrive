import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeAnalytics } from "../analytics-fixture";
import { ActivityChart } from "./ActivityChart";
import { AiHealthTile } from "./AiHealthTile";
import { KpiTile } from "./KpiTile";
import { OutcomeDonut } from "./OutcomeDonut";
import { PackageMix } from "./PackageMix";
import { StageFunnel } from "./StageFunnel";
import {
  formatCompactMoney,
  formatHours,
  formatLatency,
  formatWeek,
  niceScale,
} from "./chart-theme";

const data = makeAnalytics();

// jsdom has no layout, so give every element a size for the charts to draw in.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    value: 640,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: 220,
  });
});
afterEach(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)
    .clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)
    .clientHeight;
});

describe("chart-theme helpers", () => {
  it("formats money, time and weeks for display", () => {
    expect(formatCompactMoney(75806)).toBe("$75.8K");
    expect(formatHours(0.5)).toBe("30 min");
    expect(formatHours(9)).toBe("9 h");
    expect(formatHours(72)).toBe("3.0 d");
    expect(formatLatency(850)).toBe("850 ms");
    expect(formatLatency(22000)).toBe("22.0 s");
    expect(formatWeek("2026-09-21")).toBe("Sep 21");
  });

  it("builds a round axis from zero", () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
    const { max, ticks } = niceScale(17, 3);
    expect(ticks[0]).toBe(0);
    expect(max).toBeGreaterThanOrEqual(17);
    expect(ticks.at(-1)).toBe(max);
  });
});

describe("ActivityChart", () => {
  it("reads a week with the arrow keys and clears on Escape", () => {
    render(<ActivityChart weekly={data.weekly} />);
    const chart = screen.getByRole("group", { name: /Weekly activity chart/ });

    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByText("Week of Sep 28")).toBeInTheDocument();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByText("Week of Sep 21")).toBeInTheDocument();
    expect(screen.getByText("Approvals decided")).toBeInTheDocument();

    fireEvent.keyDown(chart, { key: "Escape" });
    expect(screen.queryByText("Week of Sep 21")).not.toBeInTheDocument();
  });

  it("toggles a series off but never hides the last one", () => {
    render(<ActivityChart weekly={data.weekly} />);
    const opps = screen.getByRole("button", { name: "Opportunities created" });
    const versions = screen.getByRole("button", { name: "Versions created" });

    fireEvent.click(opps);
    expect(opps).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(versions);
    expect(versions).toHaveAttribute("aria-pressed", "true");
  });

  it("offers the same numbers as a table", () => {
    render(<ActivityChart weekly={data.weekly} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Show table for Weekly activity/ }),
    );
    const table = screen.getByRole("table", { name: "Weekly activity" });
    expect(within(table).getByText("Sep 21")).toBeInTheDocument();
    expect(within(table).getByText("$89,477")).toBeInTheDocument();
  });
});

describe("StageFunnel", () => {
  it("pins a stage's detail on click and releases it on a second click", () => {
    render(<StageFunnel stages={data.stages} />);
    expect(
      screen.getByText("Select a stage for its detail."),
    ).toBeInTheDocument();

    const approved = screen.getByRole("button", {
      name: /^Approved: 9 versions/,
    });
    fireEvent.click(approved);
    expect(approved).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(/9 versions, \$59,224\/mo, 21% of all/),
    ).toBeInTheDocument();

    fireEvent.click(approved);
    expect(
      screen.getByText("Select a stage for its detail."),
    ).toBeInTheDocument();
  });

  it("lists off-path outcomes as chips that can be selected", () => {
    render(<StageFunnel stages={data.stages} />);
    const chip = screen.getByRole("button", { name: /Changes requested 4/ });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/4 versions, \$9,000\/mo/)).toBeInTheDocument();
  });

  it("shows a tooltip while hovering a stage", () => {
    render(<StageFunnel stages={data.stages} />);
    fireEvent.pointerMove(
      screen.getByRole("button", { name: /^Won: 9 versions/ }),
      { clientX: 200, clientY: 40 },
    );
    expect(screen.getByText("Share of all versions")).toBeInTheDocument();
  });
});

describe("OutcomeDonut", () => {
  it("shows the win rate, then the hovered outcome, then pins on click", () => {
    render(<OutcomeDonut stages={data.stages} winRate={75} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("win rate")).toBeInTheDocument();

    const lost = screen.getByRole("button", { name: /Lost 3/ });
    fireEvent.pointerEnter(lost);
    expect(screen.getByText(/Lost · 21%/)).toBeInTheDocument();
    fireEvent.pointerLeave(lost);
    expect(screen.getByText("win rate")).toBeInTheDocument();

    fireEvent.click(lost);
    expect(lost).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Lost · 21%/)).toBeInTheDocument();
  });

  it("says so when there are no outcomes yet", () => {
    render(<OutcomeDonut stages={[]} winRate={null} />);
    expect(
      screen.getByText("Shared proposals and their outcomes will appear here."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Win rate needs at least one won or lost deal/),
    ).toBeInTheDocument();
  });
});

describe("PackageMix", () => {
  it("re-sorts between value and units", () => {
    render(<PackageMix packages={data.packages} />);
    const names = () =>
      screen
        .getAllByRole("group", { name: /per month$/ })
        .map((el) => el.getAttribute("aria-label")?.split(":")[0]);
    expect(names()[0]).toBe("Hybrid Account Manager");

    fireEvent.click(screen.getByRole("button", { name: "By units" }));
    expect(names()[0]).toBe("Long Distance");
    expect(screen.getByRole("button", { name: "By units" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("notes how many packages only the table view shows", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `Pack ${i}`,
      category: "c",
      quantity: i + 1,
      value: String((i + 1) * 100),
    }));
    render(<PackageMix packages={many} />);
    expect(screen.getByText("+2 more in the table view")).toBeInTheDocument();
  });
});

describe("KpiTile and AiHealthTile", () => {
  it("reads one week of the sparkline into the tile on hover", () => {
    render(
      <MemoryRouter>
        <KpiTile
          label="Open pipeline"
          value="$75.8K/mo"
          hint="across 19 open"
          href="/opportunities"
          spark={{
            values: [1, 5],
            labels: ["Sep 14", "Sep 21"],
            format: (n) => `${n} drafted`,
          }}
        />
      </MemoryRouter>,
    );
    const svg = document.querySelector("svg") as SVGSVGElement;
    act(() => {
      fireEvent.pointerMove(svg, { clientX: 0 });
    });
    expect(screen.getByText("Week of Sep 14: 1 drafted")).toBeInTheDocument();
    fireEvent.pointerLeave(svg);
    expect(screen.getByText("across 19 open")).toBeInTheDocument();
  });

  it("splits AI drafts into direct, fallback and failed", () => {
    render(<AiHealthTile ai={data.ai} successRate={83.3} generations={18} />);
    expect(screen.getByText("83%")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Drafted directly 14, Drafted via fallback 1, Failed 3/,
      }),
    ).toBeInTheDocument();
  });

  it("explains an empty range", () => {
    render(<AiHealthTile ai={[]} successRate={null} generations={0} />);
    expect(screen.getByText("n/a")).toBeInTheDocument();
    expect(
      screen.getByText("No generations in this range"),
    ).toBeInTheDocument();
  });
});
