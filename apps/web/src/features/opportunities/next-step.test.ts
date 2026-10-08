import { describe, expect, it } from "vitest";

import type { Opportunity, ProposalVersion } from "../../lib/api";
import { nextStep } from "./next-step";

const base: Opportunity = {
  id: 1,
  organization_id: 1,
  customer_id: 1,
  owner_id: 1,
  title: "Deal",
  status: "open",
  brief_json: null,
};

function version(number: number, status: string, id = number): ProposalVersion {
  return {
    id,
    organization_id: 1,
    opportunity_id: 1,
    version_number: number,
    status: status as ProposalVersion["status"],
    narrative_json: null,
    content_json: { lines: [] },
    total_estimate: "0",
    created_by: 1,
  };
}

describe("nextStep", () => {
  it("starts an opportunity with no brief by offering to draft it with AI", () => {
    const step = nextStep(base, [], true);
    expect(step.title).toBe("Start with a discovery brief");
    expect(step.cta).toEqual({
      label: "Draft with AI",
      action: { kind: "brief" },
      ai: true,
    });
    expect(step.tone).toBe("action");
  });

  it("moves on to the first proposal once there is a brief", () => {
    const step = nextStep({ ...base, brief_json: { summary: "x" } }, [], true);
    expect(step.title).toBe("Build the first proposal");
    expect(step.cta?.action).toEqual({ kind: "create-draft" });
  });

  it("never offers an action to someone who can't edit", () => {
    expect(nextStep(base, [], false).cta).toBeUndefined();
    expect(
      nextStep({ ...base, brief_json: { a: 1 } }, [], false).cta,
    ).toBeUndefined();
    expect(nextStep(base, [version(1, "draft")], false).cta).toBeUndefined();
    expect(nextStep(base, [version(1, "expired")], false).cta).toBeUndefined();
  });

  it.each([
    ["draft", "Finish Version 2", "Continue proposal", "action"],
    ["configured", "Finish Version 2", "Continue proposal", "action"],
    [
      "proposal_drafted",
      "Submit Version 2 for approval",
      "Open proposal",
      "action",
    ],
    ["changes_requested", "Revise Version 2", "Review feedback", "action"],
    [
      "approved",
      "Share Version 2 with the customer",
      "Open proposal",
      "action",
    ],
    ["shared", "Waiting for the customer", "Record outcome", "waiting"],
  ])("for a %s latest version: %s", (status, title, cta, tone) => {
    const step = nextStep(
      base,
      [version(1, "changes_requested"), version(2, status)],
      true,
    );
    expect(step.title).toBe(title);
    expect(step.cta?.label).toBe(cta);
    expect(step.cta?.action).toEqual({ kind: "open-version", versionId: 2 });
    expect(step.tone).toBe(tone);
  });

  it("waits quietly while an approver decides", () => {
    const step = nextStep(base, [version(1, "awaiting_approval")], true);
    expect(step.tone).toBe("waiting");
    expect(step.cta).toBeUndefined();
  });

  it("offers a fresh version when the last one expired", () => {
    const step = nextStep(base, [version(1, "expired")], true);
    expect(step.title).toBe("Version 1 has expired");
    expect(step.cta?.action).toEqual({ kind: "create-draft" });
  });

  it("reports closed deals as done", () => {
    expect(
      nextStep({ ...base, status: "won" }, [version(1, "won")], true),
    ).toMatchObject({
      tone: "done",
      title: "Won. Nothing left to do.",
    });
    expect(nextStep({ ...base, status: "lost" }, [], true).title).toBe(
      "Closed as lost.",
    );
  });
});
