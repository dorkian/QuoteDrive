import type { Role } from "../../lib/api";

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Matches an element's `data-tour` attribute. Omit for a centred card. */
  target?: string;
  /** Go here first, so the target exists. */
  route?: string;
}

const WELCOME: TourStep = {
  id: "welcome",
  title: "Welcome to QuoteDrive",
  body: "A quick tour, about a minute. You can skip it now and replay it any time from the Help button.",
};

const DASHBOARD: TourStep = {
  id: "dashboard",
  title: "Your pipeline at a glance",
  body: "These tiles and charts update with the time range. Hover or focus any chart for details, or use its table icon for exact numbers.",
  target: "kpis",
  route: "/",
};

const AI: TourStep = {
  id: "ai",
  title: "AI drafts. You decide.",
  body: "Look for the sparkle: Draft with AI writes a discovery brief or a proposal narrative from the facts you supply. Every draft is labelled for review, and nothing is saved until you do.",
};

const HELP: TourStep = {
  id: "help",
  title: "Help is always here",
  body: "Replay this tour or bring back the tips from this menu. Press ⌘K anywhere to jump to a page.",
  target: "help",
};

const MANAGER: TourStep[] = [
  WELCOME,
  DASHBOARD,
  {
    id: "opportunities",
    title: "Everything starts with an opportunity",
    body: "Open the list to see every deal, its stage and its next step.",
    target: "nav-opportunities",
  },
  {
    id: "open-row",
    title: "Click a row to open it",
    body: "Details open in a side panel, so you keep your place. The panel's Next step tells you what to do: draft the brief with AI, build the proposal, then submit it.",
    target: "opportunities-table",
    route: "/opportunities",
  },
  AI,
  {
    id: "approvals",
    title: "Approvals keep it honest",
    body: "A second person approves every proposal before it can be shared. Their queue lives here.",
    target: "nav-approvals",
  },
  HELP,
];

const APPROVER: TourStep[] = [
  WELCOME,
  DASHBOARD,
  {
    id: "approvals",
    title: "Your approval queue",
    body: "Requests assigned to you wait here. The Waiting column turns orange after two days so nothing slips.",
    target: "nav-approvals",
  },
  {
    id: "approvals-list",
    title: "Open a request to review it",
    body: "You'll see the proposal, what changed from the previous version, and can approve or ask for changes with a comment.",
    target: "approvals-table",
    route: "/approvals",
  },
  AI,
  HELP,
];

const VIEWER: TourStep[] = [
  WELCOME,
  DASHBOARD,
  {
    id: "opportunities",
    title: "Browse opportunities",
    body: "You have read-only access. Open any row to see its details, proposals and history.",
    target: "nav-opportunities",
  },
  HELP,
];

export function tourFor(role: Role): TourStep[] {
  if (role === "viewer") return VIEWER;
  if (role === "approver") return APPROVER;
  return MANAGER;
}
