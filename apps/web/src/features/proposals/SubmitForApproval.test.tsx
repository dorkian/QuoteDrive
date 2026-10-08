import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { SubmitForApproval } from "./SubmitForApproval";

vi.mock("../../lib/api");

const drafted: api.ProposalVersion = {
  id: 5,
  organization_id: 1,
  opportunity_id: 1,
  version_number: 2,
  status: "proposal_drafted",
  content_json: { lines: [] },
  narrative_json: null,
  total_estimate: "7528.00",
  created_by: 1,
};
const submitted = { ...drafted, status: "awaiting_approval" as const };
const approvers: api.ApproverOption[] = [
  { user_id: 7, display_name: "Ada Approver", role: "approver" },
  { user_id: 8, display_name: "Root Admin", role: "admin" },
];

function renderIt(version: api.ProposalVersion = drafted) {
  const onChanged = vi.fn();
  render(
    <SubmitForApproval
      token="t"
      role="proposal_manager"
      version={version}
      onChanged={onChanged}
    />,
  );
  return onChanged;
}

async function openAndPick(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: /submit for approval/i }));
  const select = await screen.findByLabelText("Approver");
  await waitFor(() => expect(select).not.toBeDisabled());
  fireEvent.change(select, {
    target: {
      value: String(approvers.find((a) => name.test(a.display_name))!.user_id),
    },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.fetchApprovers).mockResolvedValue(approvers);
});

describe("SubmitForApproval", () => {
  it.each([
    "draft",
    "awaiting_approval",
    "approved",
    "changes_requested",
  ] as const)("renders nothing for a %s version", (status) => {
    const { container } = render(
      <SubmitForApproval
        token="t"
        role="admin"
        version={{ ...drafted, status }}
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("disables submit until an approver is chosen, then submits and assigns", async () => {
    vi.mocked(api.submitProposalVersion).mockResolvedValue(submitted);
    vi.mocked(api.requestApproval).mockResolvedValue();
    const onChanged = renderIt();

    fireEvent.click(
      screen.getByRole("button", { name: /submit for approval/i }),
    );
    await screen.findByRole("option", { name: /Ada Approver/ });
    const confirm = screen.getAllByRole("button", {
      name: /submit for approval/i,
    })[0];
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Approver"), {
      target: { value: "7" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /^submit for approval$/i }),
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(submitted));
    expect(api.submitProposalVersion).toHaveBeenCalledWith("t", 5);
    expect(api.requestApproval).toHaveBeenCalledWith("t", 5, 7);
  });

  it("does not request approval when submit fails", async () => {
    vi.mocked(api.submitProposalVersion).mockRejectedValue(new Error("boom"));
    const onChanged = renderIt();
    await openAndPick(/Ada/);

    fireEvent.click(
      screen.getByRole("button", { name: /^submit for approval$/i }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(api.requestApproval).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("retries only the approval request after a partial failure", async () => {
    vi.mocked(api.submitProposalVersion).mockResolvedValue(submitted);
    vi.mocked(api.requestApproval)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce();
    const onChanged = renderIt();
    await openAndPick(/Ada/);

    fireEvent.click(
      screen.getByRole("button", { name: /^submit for approval$/i }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: /^submit for approval$/i }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(submitted));
    expect(api.submitProposalVersion).toHaveBeenCalledTimes(1);
    expect(api.requestApproval).toHaveBeenCalledTimes(2);
  });

  it("keeps an 'Assign approver' button if the dialog is closed after a partial failure", async () => {
    vi.mocked(api.submitProposalVersion).mockResolvedValue(submitted);
    vi.mocked(api.requestApproval).mockRejectedValue(new Error("boom"));
    const onChanged = renderIt();
    await openAndPick(/Ada/);
    fireEvent.click(
      screen.getByRole("button", { name: /^submit for approval$/i }),
    );
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(submitted));
    expect(
      screen.getByRole("button", { name: "Assign approver" }),
    ).toBeInTheDocument();
  });

  it("explains when nobody can approve", async () => {
    vi.mocked(api.fetchApprovers).mockResolvedValue([]);
    renderIt();
    fireEvent.click(
      screen.getByRole("button", { name: /submit for approval/i }),
    );
    expect(
      await screen.findByText(/No one else in this workspace can approve/),
    ).toBeInTheDocument();
  });

  it("shows an error when approvers can't be loaded", async () => {
    vi.mocked(api.fetchApprovers).mockRejectedValue(new Error("down"));
    renderIt();
    fireEvent.click(
      screen.getByRole("button", { name: /submit for approval/i }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
