import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { ApiError } from "../../lib/errors";
import { VersionLifecycleActions } from "./VersionLifecycleActions";

vi.mock("../../lib/api");

const base: api.ProposalVersion = {
  id: 5,
  organization_id: 1,
  opportunity_id: 1,
  version_number: 3,
  status: "approved",
  content_json: { lines: [] },
  narrative_json: null,
  total_estimate: "7528.00",
  created_by: 1,
};

function renderActions(version: api.ProposalVersion) {
  const onChanged = vi.fn();
  render(
    <VersionLifecycleActions
      token="t"
      role="proposal_manager"
      version={version}
      onChanged={onChanged}
    />,
  );
  return onChanged;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("VersionLifecycleActions", () => {
  it("renders nothing before approval or after an outcome", () => {
    const { container } = render(
      <>
        <VersionLifecycleActions
          token="t"
          role="admin"
          version={{ ...base, status: "awaiting_approval" }}
          onChanged={vi.fn()}
        />
        <VersionLifecycleActions
          token="t"
          role="admin"
          version={{ ...base, status: "won" }}
          onChanged={vi.fn()}
        />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks an approved version as shared after confirmation", async () => {
    const shared = { ...base, status: "shared" as const };
    vi.mocked(api.shareProposalVersion).mockResolvedValue(shared);
    const onChanged = renderActions(base);

    fireEvent.click(screen.getByRole("button", { name: "Mark as shared" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Mark version 3 as shared?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Mark as shared" }),
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(shared));
    expect(api.shareProposalVersion).toHaveBeenCalledWith("t", 5);
  });

  it("records an outcome only once one is chosen", async () => {
    const won = { ...base, status: "won" as const };
    vi.mocked(api.recordProposalOutcome).mockResolvedValue(won);
    const onChanged = renderActions({ ...base, status: "shared" });

    fireEvent.click(screen.getByRole("button", { name: "Record outcome" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Record the outcome of version 3",
    });
    const confirm = within(dialog).getByRole("button", {
      name: "Record outcome",
    });
    expect(confirm).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("radio", { name: /^Won/ }));
    fireEvent.click(confirm);

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(won));
    expect(api.recordProposalOutcome).toHaveBeenCalledWith("t", 5, "won");
  });

  it("keeps the dialog open with the API message on failure", async () => {
    vi.mocked(api.shareProposalVersion).mockRejectedValue(
      new ApiError(400, "Failed", "Only an approved version can be shared"),
    );
    const onChanged = renderActions(base);

    fireEvent.click(screen.getByRole("button", { name: "Mark as shared" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Mark as shared" }),
    );

    expect(
      await within(dialog).findByText("Couldn't share this version."),
    ).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
