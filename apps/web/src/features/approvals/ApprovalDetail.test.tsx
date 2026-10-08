import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { ApiError } from "../../lib/errors";
import { ApprovalDetail } from "./ApprovalDetail";

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return {
    ...actual,
    fetchApprovalRequest: vi.fn(),
    fetchProposalVersion: vi.fn(),
    fetchProposalVersions: vi.fn(),
    approveRequest: vi.fn(),
    requestChanges: vi.fn(),
    fetchMe: vi.fn(),
    fetchOpportunity: vi.fn(),
  };
});

const approverMe: api.Me = {
  user: { id: 2, email: "approver@example.com", display_name: "Approver User" },
  organization: {
    id: 1,
    name: "Acme Corp",
    slug: "acme",
  },
  role: "approver",
};

const ownerMe: api.Me = {
  user: { id: 1, email: "owner@example.com", display_name: "Owner User" },
  organization: {
    id: 1,
    name: "Acme Corp",
    slug: "acme",
  },
  role: "admin",
};

const mockRequest: api.ApprovalRequest = {
  id: 10,
  organization_id: 1,
  proposal_version_id: 5,
  requested_by: 1,
  assigned_to: 2,
  status: "pending",
  decision_at: null,
  created_at: "2026-09-20T10:00:00Z",
  opportunity_id: 1,
  opportunity_title: "Clean Energy Transition",
  version_number: 2,
  requested_by_name: "Owner User",
  assigned_to_name: "Approver User",
};

const mockVersion: api.ProposalVersion = {
  id: 5,
  organization_id: 1,
  opportunity_id: 1,
  version_number: 2,
  status: "awaiting_approval",
  narrative_json: null,
  content_json: {
    lines: [
      {
        catalogue_item_id: 10,
        name: "Electric Sedan",
        category: "electric",
        quantity: 3,
        add_on_item_ids: [],
        unit_estimate: "500.00",
        line_total: "1500.00",
        assumptions: "Standard lease",
      },
    ],
  },
  total_estimate: "1500.00",
  created_by: 1,
};

const mockPrevVersion: api.ProposalVersion = {
  id: 4,
  organization_id: 1,
  opportunity_id: 1,
  version_number: 1,
  status: "changes_requested",
  narrative_json: null,
  content_json: {
    lines: [
      {
        catalogue_item_id: 10,
        name: "Electric Sedan",
        category: "electric",
        quantity: 2,
        add_on_item_ids: [],
        unit_estimate: "500.00",
        line_total: "1000.00",
        assumptions: "Standard lease",
      },
    ],
  },
  total_estimate: "1000.00",
  created_by: 1,
};

function renderDetail(me: api.Me = approverMe, requestId = "10") {
  localStorage.setItem("quotedrive.token", "test-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/approvals/${requestId}`]}>
        <Routes>
          <Route path="/approvals/:requestId" element={<ApprovalDetail />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(api.fetchApprovalRequest).mockResolvedValue(mockRequest);
  vi.mocked(api.fetchProposalVersion).mockResolvedValue(mockVersion);
  vi.mocked(api.fetchProposalVersions).mockResolvedValue([
    mockVersion,
    mockPrevVersion,
  ]);
});

describe("ApprovalDetail", () => {
  it("explains the restriction to non-approvers instead of failing to load", async () => {
    renderDetail({ ...approverMe, role: "viewer" });

    expect(
      await screen.findByText(
        "Your role (Viewer) can't review approval requests.",
      ),
    ).toBeInTheDocument();
    expect(api.fetchApprovalRequest).not.toHaveBeenCalled();
  });

  it("shows the API's reason when an approval is forbidden", async () => {
    vi.mocked(api.approveRequest).mockRejectedValue(
      new ApiError(403, "Failed", "Cannot approve your own version"),
    );
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm approve" }));

    expect(
      await screen.findByText("Cannot approve your own version."),
    ).toBeInTheDocument();
  });

  it("renders proposal details, lines, and comparison with previous version", async () => {
    renderDetail();

    await waitFor(() =>
      expect(screen.getByText(/Clean Energy Transition/)).toBeInTheDocument(),
    );
    expect(screen.getByText("Total: $1500.00")).toBeInTheDocument();
    expect(screen.getByText("Electric Sedan · qty 3")).toBeInTheDocument();
    expect(screen.getByText("Comparison with Version 1")).toBeInTheDocument();
  });

  it("shows self-submitter guard when the acting user created the version", async () => {
    renderDetail(ownerMe);

    await waitFor(() =>
      expect(
        screen.getByText(
          "You submitted this version and cannot approve or request changes on your own proposal.",
        ),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request changes" }),
    ).not.toBeInTheDocument();
  });

  it("executes the approve flow with inline confirmation and optional comment", async () => {
    vi.mocked(api.approveRequest).mockResolvedValue({
      ...mockRequest,
      status: "approved",
      decision_at: "2026-09-21T12:00:00Z",
    });

    renderDetail();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Approve" }),
      ).toBeInTheDocument(),
    );

    const textarea = screen.getByPlaceholderText(
      "Add notes or reason for changes...",
    );
    fireEvent.change(textarea, { target: { value: "Approved, looks great." } });

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(
      screen.getByText("Confirm approval of this version?"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm approve" }));

    await waitFor(() => {
      expect(api.approveRequest).toHaveBeenCalledWith(
        "test-token",
        10,
        "Approved, looks great.",
      );
      expect(
        screen.getByText("Proposal version approved successfully."),
      ).toBeInTheDocument();
    });
  });

  it("sends no decision when the approver cancels the confirmation", async () => {
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(api.approveRequest).not.toHaveBeenCalled();
    expect(api.requestChanges).not.toHaveBeenCalled();
  });

  it("validates that comment is not blank before requesting changes", async () => {
    renderDetail();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Request changes" }),
      ).toBeInTheDocument(),
    );

    // Click without comment
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));

    expect(
      screen.getByText("A comment is required when requesting changes."),
    ).toBeInTheDocument();
    expect(api.requestChanges).not.toHaveBeenCalled();

    // Fill comment with only spaces
    const textarea = screen.getByPlaceholderText(
      "Add notes or reason for changes...",
    );
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));

    expect(
      screen.getByText("A comment is required when requesting changes."),
    ).toBeInTheDocument();
    expect(api.requestChanges).not.toHaveBeenCalled();
  });

  it("executes request changes flow with valid comment", async () => {
    vi.mocked(api.requestChanges).mockResolvedValue({
      ...mockRequest,
      status: "changes_requested",
      decision_at: "2026-09-21T12:00:00Z",
    });

    renderDetail();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Request changes" }),
      ).toBeInTheDocument(),
    );

    const textarea = screen.getByPlaceholderText(
      "Add notes or reason for changes...",
    );
    fireEvent.change(textarea, {
      target: { value: "Please include maintenance add-on." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));

    expect(
      screen.getByText("Confirm request changes and fork draft?"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm request changes" }),
    );

    await waitFor(() => {
      expect(api.requestChanges).toHaveBeenCalledWith(
        "test-token",
        10,
        "Please include maintenance add-on.",
      );
      expect(
        screen.getByText(
          "Changes requested. A new draft version has been forked.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("handles first version with no previous version", async () => {
    vi.mocked(api.fetchProposalVersions).mockResolvedValue([mockVersion]); // only v2 exists, so no v1

    renderDetail();

    await waitFor(() =>
      expect(
        screen.getByText("First version — no previous version to compare."),
      ).toBeInTheDocument(),
    );
  });

  it("displays error for non-numeric requestId instead of infinite loading", async () => {
    renderDetail(approverMe, "invalid-id");

    await waitFor(() =>
      expect(
        screen.getByText(
          "This approval request doesn't exist or isn't in your organization.",
        ),
      ).toBeInTheDocument(),
    );
  });

  it("preserves header details and does not blank out after approving", async () => {
    // Return minimal base fields to test merge resilience
    vi.mocked(api.approveRequest).mockResolvedValue({
      ...mockRequest,
      status: "approved",
      decision_at: "2026-09-21T12:00:00Z",
    });

    renderDetail();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Approve" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm approve" }));

    await waitFor(() =>
      expect(
        screen.getByText("Proposal version approved successfully."),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByText("Clean Energy Transition · Version 2"),
    ).toBeInTheDocument();
  });
});
