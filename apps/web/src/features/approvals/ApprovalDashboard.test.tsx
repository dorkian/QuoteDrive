import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { ApprovalDashboard } from "./ApprovalDashboard";

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return {
    ...actual,
    fetchApprovalRequests: vi.fn(),
    fetchMe: vi.fn(),
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

const viewerMe: api.Me = {
  user: { id: 3, email: "viewer@example.com", display_name: "Viewer User" },
  organization: {
    id: 1,
    name: "Acme Corp",
    slug: "acme",
  },
  role: "viewer",
};

const mockRequests: api.ApprovalRequest[] = [
  {
    id: 101,
    organization_id: 1,
    proposal_version_id: 5,
    requested_by: 1,
    assigned_to: 2,
    status: "pending",
    decision_at: null,
    created_at: "2026-09-20T10:00:00Z",
    opportunity_id: 10,
    opportunity_title: "Green Logistics Fleet",
    version_number: 2,
    requested_by_name: "Proposal Manager",
    assigned_to_name: "Approver User",
  },
];

function renderDashboard(me: api.Me = approverMe) {
  localStorage.setItem("quotedrive.token", "test-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter>
        <ApprovalDashboard />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("ApprovalDashboard", () => {
  it("renders pending approval requests with title, submitter, and version", async () => {
    vi.mocked(api.fetchApprovalRequests).mockResolvedValue(mockRequests);

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Green Logistics Fleet")).toBeInTheDocument(),
    );
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText(/Proposal Manager/)).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("shows empty state when there are no pending approvals", async () => {
    vi.mocked(api.fetchApprovalRequests).mockResolvedValue([]);

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("No pending approvals.")).toBeInTheDocument(),
    );
  });

  it("shows error alert on fetch failure", async () => {
    vi.mocked(api.fetchApprovalRequests).mockRejectedValue(
      new Error("Network error"),
    );

    renderDashboard();

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't load pending approvals."),
      ).toBeInTheDocument(),
    );
  });

  it("shows restriction message for non-approver roles", async () => {
    renderDashboard(viewerMe);

    await waitFor(() =>
      expect(
        screen.getByText("Your role (Viewer) can't review approval requests."),
      ).toBeInTheDocument(),
    );
    expect(api.fetchApprovalRequests).not.toHaveBeenCalled();
  });
});
