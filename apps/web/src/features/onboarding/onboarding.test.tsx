import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AuthProvider } from "../../lib/auth-context";
import { TipBanner } from "./TipBanner";
import { TourProvider } from "./TourProvider";
import { resetTips, tipsKey, tourKey } from "./tips";
import { tourFor } from "./tour-steps";

vi.mock("../../lib/api");

const manager: api.Me = {
  user: { id: 1, email: "manager@northstar.example", display_name: "Manager" },
  organization: { id: 1, name: "Northstar", slug: "northstar" },
  role: "proposal_manager",
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderApp(ui: React.ReactNode, me: api.Me = manager) {
  localStorage.setItem("quotedrive.token", "stored-token");
  vi.mocked(api.fetchMe).mockResolvedValue(me);
  return render(
    <AuthProvider>
      <MemoryRouter>
        {ui}
        <Where />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("tourFor", () => {
  it("gives each role the steps that matter to them", () => {
    const ids = (role: api.Role) => tourFor(role).map((s) => s.id);
    expect(ids("proposal_manager")).toContain("open-row");
    expect(ids("admin")).toEqual(ids("proposal_manager"));
    expect(ids("approver")).toContain("approvals-list");
    expect(ids("approver")).not.toContain("open-row");
    expect(ids("viewer")).not.toContain("approvals");
  });

  it("starts with a welcome, ends with where to find help, and explains AI to everyone who can use it", () => {
    for (const role of ["proposal_manager", "approver", "viewer"] as const) {
      const steps = tourFor(role);
      expect(steps[0].id).toBe("welcome");
      expect(steps.at(-1)?.id).toBe("help");
    }
    expect(tourFor("proposal_manager").some((s) => s.id === "ai")).toBe(true);
  });
});

describe("TipBanner", () => {
  it("shows once, and stays dismissed after Got it", async () => {
    const { unmount } = renderApp(
      <TipBanner id="demo-tip">Click a row.</TipBanner>,
    );

    expect(await screen.findByText("Click a row.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText("Click a row.")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(tipsKey(1))!)).toEqual(["demo-tip"]);

    unmount();
    renderApp(<TipBanner id="demo-tip">Click a row.</TipBanner>);
    await waitFor(() => expect(api.fetchMe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Click a row.")).not.toBeInTheDocument();
  });

  it("comes back when tips are reset", async () => {
    localStorage.setItem(tipsKey(1), JSON.stringify(["demo-tip"]));
    renderApp(
      <TipBanner id="demo-tip" ai>
        Let AI draft it.
      </TipBanner>,
    );
    await waitFor(() => expect(api.fetchMe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Let AI draft it.")).not.toBeInTheDocument();

    resetTips(1);

    expect(await screen.findByText("Let AI draft it.")).toBeInTheDocument();
  });

  it("survives storage that throws", async () => {
    renderApp(<TipBanner id="demo-tip">Click a row.</TipBanner>);
    expect(await screen.findByText("Click a row.")).toBeInTheDocument();
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText("Click a row.")).not.toBeInTheDocument();
    spy.mockRestore();
  });
});

describe("TourProvider", () => {
  function Targets() {
    return (
      <>
        <div data-tour="kpis">KPIs</div>
        <button data-tour="nav-opportunities">Opportunities</button>
        <div data-tour="opportunities-table">Table</div>
        <button data-tour="nav-approvals">Approvals</button>
        <button data-tour="help">Help</button>
      </>
    );
  }

  it("does not start by itself when auto-start is off", async () => {
    renderApp(
      <TourProvider autoStart={false}>
        <Targets />
      </TourProvider>,
    );
    await waitFor(() => expect(api.fetchMe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 1200));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("welcomes a first-time user, walks the steps, and remembers it finished", async () => {
    renderApp(
      <TourProvider>
        <Targets />
      </TourProvider>,
    );

    const welcome = await screen.findByRole(
      "dialog",
      { name: "Welcome to QuoteDrive" },
      { timeout: 3000 },
    );
    expect(within(welcome).getByText("Step 1 of 7")).toBeInTheDocument();
    expect(
      within(welcome).queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(welcome).getByRole("button", { name: "Next" }));
    const kpis = await screen.findByRole("dialog", {
      name: "Your pipeline at a glance",
    });
    expect(within(kpis).getByText("Step 2 of 7")).toBeInTheDocument();

    fireEvent.click(within(kpis).getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("dialog", { name: "Welcome to QuoteDrive" }),
    ).toBeInTheDocument();

    // Walk to the end with the keyboard.
    for (let i = 0; i < 6; i++) {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
      await screen.findByText(`Step ${i + 2} of 7`);
    }
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(tourKey(1))).toBe("done");
  });

  it("goes to the page a step is about", async () => {
    renderApp(
      <TourProvider>
        <Targets />
      </TourProvider>,
    );
    await screen.findByRole(
      "dialog",
      { name: "Welcome to QuoteDrive" },
      { timeout: 3000 },
    );
    expect(screen.getByTestId("where")).toHaveTextContent("/");

    for (let i = 0; i < 3; i++)
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    await screen.findByRole("dialog", { name: "Click a row to open it" });

    expect(screen.getByTestId("where")).toHaveTextContent("/opportunities");
  });

  it("can be skipped with Esc, and then never nags again", async () => {
    const { unmount } = renderApp(
      <TourProvider>
        <Targets />
      </TourProvider>,
    );
    await screen.findByRole(
      "dialog",
      { name: "Welcome to QuoteDrive" },
      { timeout: 3000 },
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(tourKey(1))).toBe("done");

    unmount();
    renderApp(
      <TourProvider>
        <Targets />
      </TourProvider>,
    );
    await waitFor(() => expect(api.fetchMe).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 1200));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps Tab inside the step card", async () => {
    renderApp(
      <TourProvider>
        <Targets />
      </TourProvider>,
    );
    const welcome = await screen.findByRole(
      "dialog",
      { name: "Welcome to QuoteDrive" },
      { timeout: 3000 },
    );
    const next = within(welcome).getByRole("button", { name: "Next" });
    const skip = within(welcome).getByRole("button", { name: "Skip tour" });

    next.focus();
    fireEvent.keyDown(welcome, { key: "Tab" });
    expect(skip).toHaveFocus();
    fireEvent.keyDown(welcome, { key: "Tab", shiftKey: true });
    expect(next).toHaveFocus();
  });
});
