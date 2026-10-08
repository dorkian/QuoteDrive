import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProposalVersion } from "../../lib/api";
import { JourneyStepper } from "./JourneyStepper";
import { currentStep } from "./journey";

function version(status: string, narrative = false): ProposalVersion {
  return {
    id: 1,
    organization_id: 1,
    opportunity_id: 1,
    version_number: 1,
    status: status as ProposalVersion["status"],
    narrative_json: narrative
      ? {
          executive_summary: "x",
          recommended_approach: "x",
          scope: "x",
          assumptions_exclusions: [],
          next_steps: [],
          email_draft: "x",
          provider: "fake",
          model: "m",
          generated_at: "2026-09-20T10:00:00Z",
        }
      : null,
    content_json: { lines: [] },
    total_estimate: "0",
    created_by: 1,
  };
}

describe("currentStep", () => {
  it.each([
    ["draft", false, 0],
    ["configured", false, 1],
    ["configured", true, 2],
    ["proposal_drafted", true, 3],
    ["awaiting_approval", true, 3],
    ["changes_requested", true, 3],
    ["approved", true, 4],
    ["shared", true, 4],
    ["won", true, 5],
    ["lost", true, 5],
    ["expired", true, 5],
  ])("%s (narrative %s) is step %i", (status, narrative, step) => {
    expect(currentStep(version(status, narrative))).toBe(step);
  });
});

describe("JourneyStepper", () => {
  it("points a configured version at Draft with AI and explains it", () => {
    render(<JourneyStepper version={version("configured")} />);
    expect(
      screen.getByRole("navigation", { name: "Proposal progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/use Draft with AI to write the narrative/),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft with AI").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("scrolls to the AI section when its step is chosen", () => {
    const target = document.createElement("section");
    target.id = "ai-narrative";
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    render(<JourneyStepper version={version("configured")} />);
    fireEvent.click(screen.getByRole("button", { name: /Draft with AI/ }));

    expect(target.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "start" }),
    );
    target.remove();
  });

  it("does not claim the AI step was done when a version skipped it", () => {
    render(<JourneyStepper version={version("proposal_drafted", false)} />);
    expect(screen.getByText("(skipped)")).toBeInTheDocument();
  });

  it("marks every step complete once the deal is closed", () => {
    render(<JourneyStepper version={version("won", true)} />);
    expect(
      screen.getByRole("navigation").querySelector('[aria-current="step"]'),
    ).toBeNull();
    expect(screen.queryByText("(skipped)")).not.toBeInTheDocument();
  });
});
