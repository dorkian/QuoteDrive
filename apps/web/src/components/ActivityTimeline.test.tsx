import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../lib/api";
import { AuthProvider } from "../lib/auth-context";
import { ActivityTimeline } from "./ActivityTimeline";
import { describeEvent, formatRelativeTime } from "./activity-timeline-utils";

vi.mock("../lib/api");

const mockMe: api.Me = {
  user: {
    id: 1,
    email: "manager@northstar.example",
    display_name: "Proposal Manager",
  },
  organization: {
    id: 1,
    name: "Northstar Mobility Advisory",
    slug: "northstar",
  },
  role: "proposal_manager",
};

function renderWithAuth(ui: React.ReactNode) {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(mockMe);
  return render(<AuthProvider>{ui}</AuthProvider>);
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("formatRelativeTime", () => {
  it("formats past times correctly", () => {
    const now = new Date("2026-09-22T12:00:00Z");
    expect(formatRelativeTime("2026-09-22T11:59:40Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-09-22T11:55:00Z", now)).toBe(
      "5 minutes ago",
    );
    expect(formatRelativeTime("2026-09-22T10:00:00Z", now)).toBe("2 hours ago");
    expect(formatRelativeTime("2026-09-21T12:00:00Z", now)).toBe("yesterday");
    expect(formatRelativeTime("2026-09-19T12:00:00Z", now)).toBe("3 days ago");
  });
});

describe("describeEvent", () => {
  it("describes opportunity events", () => {
    const event: api.AuditEvent = {
      id: 1,
      actor_id: 1,
      actor_name: "Proposal Manager",
      entity_type: "opportunity",
      entity_id: 42,
      action: "create",
      before_json: null,
      after_json: { title: "Deal 42" },
      created_at: "2026-09-22T10:00:00Z",
    };
    expect(describeEvent(event)).toEqual({
      actionDescription: "created opportunity",
      entityReference: "Deal 42",
    });
  });

  it("describes customer events", () => {
    const event: api.AuditEvent = {
      id: 2,
      actor_id: 1,
      actor_name: "Proposal Manager",
      entity_type: "customer",
      entity_id: 10,
      action: "update",
      before_json: null,
      after_json: { name: "Acme Corp" },
      created_at: "2026-09-22T10:00:00Z",
    };
    expect(describeEvent(event)).toEqual({
      actionDescription: "updated customer",
      entityReference: "Acme Corp",
    });
  });

  it("describes proposal version events", () => {
    const event: api.AuditEvent = {
      id: 3,
      actor_id: 1,
      actor_name: "Proposal Manager",
      entity_type: "proposal_version",
      entity_id: 5,
      action: "approve",
      before_json: null,
      after_json: { version_number: 2 },
      created_at: "2026-09-22T10:00:00Z",
    };
    expect(describeEvent(event)).toEqual({
      actionDescription: "approved proposal version",
      entityReference: "v2",
    });
  });

  it("describes approval request events", () => {
    const event: api.AuditEvent = {
      id: 4,
      actor_id: 1,
      actor_name: "Approver",
      entity_type: "approval_request",
      entity_id: 7,
      action: "request_changes",
      before_json: null,
      after_json: { comment: "Please discount 10%" },
      created_at: "2026-09-22T10:00:00Z",
    };
    expect(describeEvent(event)).toEqual({
      actionDescription: "requested changes on request",
      entityReference: "#7",
    });
  });

  // Every (entity_type, action) pair actually emitted by a
  // record_audit_event(...) call site in the backend, as of:
  // apps/api/app/api/{customers,opportunities,proposal_versions,approval_requests}.py
  // Guards against a new backend action silently falling through to the
  // generic fallback with no signal (see the comment on that fallback in
  // activity-timeline-utils.ts).
  const emittedActionPairs: Array<[string, string]> = [
    ["opportunity", "create"],
    ["opportunity", "update"],
    ["opportunity", "delete"],
    ["customer", "create"],
    ["customer", "update"],
    ["customer", "delete"],
    ["proposal_version", "create"],
    ["proposal_version", "update"],
    ["proposal_version", "finalize"],
    ["proposal_version", "submit"],
    ["proposal_version", "approve"],
    ["proposal_version", "changes_requested"],
    ["proposal_version", "save_narrative"],
    ["proposal_version", "share"],
    ["proposal_version", "outcome"],
    ["membership", "role_change"],
    ["catalogue_item", "create"],
    ["catalogue_item", "update"],
    ["approval_request", "create"],
    ["approval_request", "approve"],
    ["approval_request", "request_changes"],
  ];

  it("covers every entity_type/action pair currently emitted by the backend", () => {
    for (const [entity_type, action] of emittedActionPairs) {
      const event: api.AuditEvent = {
        id: 1,
        actor_id: 1,
        actor_name: "Someone",
        entity_type,
        entity_id: 1,
        action,
        before_json: null,
        after_json: null,
        created_at: "2026-09-22T10:00:00Z",
      };
      const { actionDescription } = describeEvent(event);
      const genericFallback = `${action.replace(/_/g, " ")} ${entity_type.replace(/_/g, " ")}`;
      expect(
        actionDescription,
        `${entity_type}/${action} has no explicit copy`,
      ).not.toBe(genericFallback);
    }
  });
});

describe("ActivityTimeline", () => {
  it("renders audit events with actor name, relative time, and entity reference", async () => {
    vi.mocked(api.fetchAuditEvents).mockResolvedValue([
      {
        id: 10,
        actor_id: 1,
        actor_name: "Jane Doe",
        entity_type: "opportunity",
        entity_id: 1,
        action: "create",
        before_json: null,
        after_json: { title: "Fleet Deal" },
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    ]);

    renderWithAuth(<ActivityTimeline />);

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
    expect(screen.getByText("created opportunity")).toBeInTheDocument();
    expect(screen.getByText("Fleet Deal")).toBeInTheDocument();
    expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
  });

  it("renders empty message when there are no events", async () => {
    vi.mocked(api.fetchAuditEvents).mockResolvedValue([]);

    renderWithAuth(<ActivityTimeline emptyMessage="Nothing happened yet." />);

    await waitFor(() => {
      expect(screen.getByText("Nothing happened yet.")).toBeInTheDocument();
    });
  });

  it("supports load more cursor pagination and hides button when exhausted", async () => {
    // limit=2 means the component internally requests limit+1=3 rows to tell
    // "exactly 2 total" apart from "more than 2 exist" (see ActivityTimeline's
    // fetchLimit). Page 1 returns 3 rows so it must slice to 2 and show
    // "Load more"; page 2 returns 1 row (<= limit), so it's shown in full and
    // the button disappears.
    const opp = (
      id: number,
      title: string,
      secondsAgo: number,
    ): api.AuditEvent => ({
      id,
      actor_id: 1,
      actor_name: "Jane Doe",
      entity_type: "opportunity",
      entity_id: id,
      action: "create",
      before_json: null,
      after_json: { title },
      created_at: new Date(Date.now() - secondsAgo * 1000).toISOString(),
    });

    const page1 = [
      opp(3, "Third Opp", 0),
      opp(2, "Second Opp", 60),
      opp(1, "First Opp", 120),
    ];
    const page2 = [opp(0, "Oldest Opp", 180)];

    vi.mocked(api.fetchAuditEvents)
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    renderWithAuth(<ActivityTimeline limit={2} />);

    await waitFor(() => {
      expect(screen.getByText("Third Opp")).toBeInTheDocument();
    });
    expect(screen.getByText("Second Opp")).toBeInTheDocument();
    // Third page item beyond `limit` was fetched only to detect hasMore, not shown
    expect(screen.queryByText("First Opp")).not.toBeInTheDocument();

    const loadMoreButton = screen.getByRole("button", { name: "Load more" });
    expect(loadMoreButton).toBeInTheDocument();

    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(screen.getByText("Oldest Opp")).toBeInTheDocument();
    });

    expect(api.fetchAuditEvents).toHaveBeenCalledWith(
      "stored-token",
      expect.objectContaining({
        limit: 3,
        beforeId: 2,
      }),
    );

    // Page 2 returned 1 item (<= limit 2), so load more button should disappear
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });
});
