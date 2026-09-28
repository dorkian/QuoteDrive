import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { ApiError } from "../../lib/errors";
import { DiscoveryBriefPanel } from "./DiscoveryBriefPanel";

vi.mock("../../lib/api");

const opportunity: api.Opportunity = {
  id: 7,
  organization_id: 1,
  customer_id: 1,
  owner_id: 1,
  title: "Fleet",
  status: "open",
  brief_json: null,
};

const draft: api.DiscoveryBriefResponse = {
  summary: "12 vans in Milan going electric.",
  requirements: ["Electric vans", "Depot charging"],
  open_questions: ["Which models?"],
  unknowns: ["Budget range"],
  disclaimer: "Draft AI Content — Requires human review",
  provider: "fake",
  model: "fake-model",
};

function renderPanel(editable = true, onSaved = vi.fn()) {
  render(
    <DiscoveryBriefPanel
      token="t"
      opportunity={opportunity}
      editable={editable}
      onSaved={onSaved}
    />,
  );
  return onSaved;
}

async function generate(): Promise<void> {
  fireEvent.change(screen.getByLabelText("Discovery notes"), {
    target: { value: "They run 12 vans." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Draft brief" }));
  await screen.findByText("Draft AI Content — Requires human review");
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DiscoveryBriefPanel", () => {
  it("drafts, lets the user edit, and saves the reviewed brief", async () => {
    vi.mocked(api.generateDiscoveryBrief).mockResolvedValue(draft);
    vi.mocked(api.saveOpportunityBrief).mockImplementation(
      async (_t, _id, brief) => ({ ...opportunity, brief_json: { ...brief } }),
    );
    const onSaved = renderPanel();

    await generate();
    expect(api.generateDiscoveryBrief).toHaveBeenCalledWith(
      "t",
      7,
      "They run 12 vans.",
    );
    fireEvent.change(screen.getByLabelText("Unknowns (one per line)"), {
      target: { value: "Budget range\nAnnual mileage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brief" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.saveOpportunityBrief).toHaveBeenCalledWith("t", 7, {
      summary: "12 vans in Milan going electric.",
      requirements: ["Electric vans", "Depot charging"],
      open_questions: ["Which models?"],
      unknowns: ["Budget range", "Annual mileage"],
      provider: "fake",
      model: "fake-model",
    });
  });

  it("discarding a draft saves nothing", async () => {
    vi.mocked(api.generateDiscoveryBrief).mockResolvedValue(draft);
    renderPanel();

    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(
      screen.queryByText("Draft AI Content — Requires human review"),
    ).not.toBeInTheDocument();
    expect(api.saveOpportunityBrief).not.toHaveBeenCalled();
  });

  it("shows a handled error when drafting fails", async () => {
    vi.mocked(api.generateDiscoveryBrief).mockRejectedValue(
      new ApiError(502, "Failed", "Bad response from provider"),
    );
    renderPanel();

    fireEvent.change(screen.getByLabelText("Discovery notes"), {
      target: { value: "notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Draft brief" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(api.saveOpportunityBrief).not.toHaveBeenCalled();
  });

  it("is read-only for roles that cannot edit", () => {
    render(
      <DiscoveryBriefPanel
        token="t"
        opportunity={{
          ...opportunity,
          brief_json: { summary: "Saved", unknowns: ["Budget range"] },
        }}
        editable={false}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Budget range")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Draft brief" }),
    ).not.toBeInTheDocument();
  });

  it("shows who wrote a saved brief, including a fallback", () => {
    render(
      <DiscoveryBriefPanel
        token="t"
        opportunity={{
          ...opportunity,
          brief_json: {
            summary: "Saved",
            provider: "ollama",
            model: "qwen",
            fallback_reason: "openrouter timeout",
          },
        }}
        editable={false}
        onSaved={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Generated locally with Ollama (fallback: OpenRouter timeout)",
      ),
    ).toBeInTheDocument();
  });

  it("disables drafting until notes are entered", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Draft brief" })).toBeDisabled();
  });
});
