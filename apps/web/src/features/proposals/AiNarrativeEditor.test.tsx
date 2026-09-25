import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { ApiError } from "../../lib/errors";
import { AiNarrativeEditor } from "./AiNarrativeEditor";

vi.mock("../../lib/api");

const draftVersion: api.ProposalVersion = {
  id: 1,
  organization_id: 1,
  opportunity_id: 1,
  version_number: 1,
  status: "draft",
  narrative_json: null,
  content_json: {
    lines: [
      {
        catalogue_item_id: 1,
        name: "Pkg",
        category: "Cat",
        quantity: 1,
        add_on_item_ids: [],
        unit_estimate: "1",
        line_total: "1",
        assumptions: null,
      },
    ],
  },
  total_estimate: "1.00",
  created_by: 1,
};

const savedVersion: api.ProposalVersion = {
  ...draftVersion,
  narrative_json: {
    executive_summary: "Saved Exec Summary",
    recommended_approach: "Saved Approach",
    scope: "Saved Scope",
    assumptions_exclusions: ["Saved Assumption"],
    next_steps: ["Saved Step"],
    email_draft: "Saved Email",
    provider: "openrouter",
    model: "anthropic/claude-3-haiku",
    generated_at: "2026-01-01T00:00:00Z",
  } as any,
};

const mockGeneratedResponse: api.ProposalNarrativeResponse = {
  executive_summary: "Gen Exec Summary",
  recommended_approach: "Gen Approach",
  scope: "Gen Scope",
  assumptions_exclusions: ["Gen Assumption"],
  next_steps: ["Gen Step"],
  email_draft: "Gen Email",
  disclaimer: "Draft AI Content — Requires human review",
  provider: "ollama",
  model: "llama3",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AiNarrativeEditor", () => {
  it("renders nothing if not editable and no narrative", () => {
    const { container } = render(
      <AiNarrativeEditor
        version={draftVersion}
        editable={false}
        token="tok"
        onSaved={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("generate happy path", async () => {
    vi.mocked(api.generateProposalNarrative).mockResolvedValue(
      mockGeneratedResponse,
    );
    render(
      <AiNarrativeEditor
        version={draftVersion}
        editable={true}
        token="tok"
        onSaved={vi.fn()}
      />,
    );

    const generateBtn = screen.getByText("Generate draft");
    fireEvent.click(generateBtn);

    expect(generateBtn).toHaveTextContent("Generating…");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Gen Exec Summary")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Generated locally with Ollama"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Draft AI Content — Requires human review"),
    ).toBeInTheDocument();

    // Save button should be disabled since it's unmodified from generation? Wait, if it's freshly generated, it's dirty relative to version!
    expect(screen.getByText("Save")).not.toBeDisabled();
  });

  it("explains a provider timeout and offers retry or writing it yourself", async () => {
    vi.mocked(api.generateProposalNarrative)
      .mockRejectedValueOnce(
        new ApiError(504, "Failed to generate narrative", "Provider timeout"),
      )
      .mockResolvedValueOnce(mockGeneratedResponse);
    render(
      <AiNarrativeEditor
        version={draftVersion}
        editable={true}
        token="tok"
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Generate draft"));

    expect(
      await screen.findByText("The AI provider took too long to respond."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Write it yourself" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByDisplayValue("Gen Exec Summary"),
    ).toBeInTheDocument();
    expect(api.generateProposalNarrative).toHaveBeenCalledTimes(2);
  });

  it("lets the user write the narrative manually when drafting fails", async () => {
    vi.mocked(api.generateProposalNarrative).mockRejectedValue(
      new ApiError(502, "Failed to generate narrative", "Bad response"),
    );
    vi.mocked(api.saveProposalVersionNarrative).mockResolvedValue(draftVersion);
    render(
      <AiNarrativeEditor
        version={draftVersion}
        editable={true}
        token="tok"
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Generate draft"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Write it yourself" }),
    );

    expect(screen.getByText("Written manually")).toBeInTheDocument();
    expect(
      screen.queryByText("Draft AI Content — Requires human review"),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Executive summary"), {
      target: { value: "Hand-written summary" },
    });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(api.saveProposalVersionNarrative).toHaveBeenCalledWith(
        "tok",
        draftVersion.id,
        expect.objectContaining({
          provider: "manual",
          executive_summary: "Hand-written summary",
        }),
      ),
    );
  });

  it("does not offer a manual fallback when drafting is forbidden", async () => {
    vi.mocked(api.generateProposalNarrative).mockRejectedValue(
      new ApiError(403, "Failed to generate narrative", null),
    );
    render(
      <AiNarrativeEditor
        version={draftVersion}
        editable={true}
        token="tok"
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Generate draft"));

    expect(
      await screen.findByText("Your role can't draft proposal narratives."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Write it yourself" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  it("retries the save, not generation, when saving fails", async () => {
    vi.mocked(api.saveProposalVersionNarrative)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(savedVersion);
    render(
      <AiNarrativeEditor
        version={savedVersion}
        editable={true}
        token="tok"
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Saved Exec Summary"), {
      target: { value: "Edited" },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(
      await screen.findByText("Couldn't save the narrative."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(api.saveProposalVersionNarrative).toHaveBeenCalledTimes(2),
    );
    expect(api.generateProposalNarrative).not.toHaveBeenCalled();
  });

  it("edit-then-save", async () => {
    vi.mocked(api.saveProposalVersionNarrative).mockResolvedValue({
      ...draftVersion,
      narrative_json: {
        ...savedVersion.narrative_json,
        executive_summary: "Edited Exec Summary",
      },
    } as any);

    const onSaved = vi.fn();
    render(
      <AiNarrativeEditor
        version={savedVersion}
        editable={true}
        token="tok"
        onSaved={onSaved}
      />,
    );

    const execInput = screen.getByDisplayValue("Saved Exec Summary");
    fireEvent.change(execInput, { target: { value: "Edited Exec Summary" } });

    const saveBtn = screen.getByText("Save");
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.saveProposalVersionNarrative).toHaveBeenCalled();
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("previously-saved narrative renders without generating", () => {
    render(
      <AiNarrativeEditor
        version={savedVersion}
        editable={true}
        token="tok"
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Saved Exec Summary")).toBeInTheDocument();
    expect(screen.getByText("Generated by OpenRouter")).toBeInTheDocument();
  });

  it("non-editable version renders read-only", () => {
    render(
      <AiNarrativeEditor
        version={savedVersion}
        editable={false}
        token="tok"
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Saved Exec Summary")).toBeDisabled();
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    expect(screen.queryByText("Generate draft")).not.toBeInTheDocument();
  });
});
