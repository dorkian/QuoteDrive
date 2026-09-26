# QD-409 UI foundation: adopt Shadcn Admin shell + components (navy/lime), restyle existing screens

> Source: Trello card https://trello.com/c/LbI92pPQ (copied word for word on 2026-09-25). Decisions made during the build are under "Amendments".

## TL;DR
Selectively port the Shadcn Admin (satnaing/shadcn-admin, MIT) shell, design tokens and shadcn/ui components into apps/web, themed in QuoteDrive navy + lime, and restyle the existing screens. No new product features, API changes or router swap. Runs after QD-402 and before QD-405, so E2E, docs screenshots and the demo video all target the final UI.

## User story
As a Proposal Manager or Approver, I want QuoteDrive to look and behave like credible enterprise SaaS (consistent shell, tables, dialogs, feedback) so the demo reads as a real product and not a prototype.

## Scope
- Included:
  - Branch `feat/ui-foundation`. Run shadcn-admin separately for reference only; do not fork it.
  - Add shadcn/ui primitives to `apps/web/src/components/ui/` (button, card, badge, table, tabs, dialog, alert-dialog, sheet, dropdown-menu, select, input, textarea, tooltip, breadcrumb, skeleton, sonner toast, command). New deps: Radix primitives, class-variance-authority, clsx, tailwind-merge, lucide-react, cmdk, sonner. Add `cn()` helper + `components.json`.
  - Design tokens in `index.css` (Tailwind v4 `@theme`): extend the existing navy scale with shadcn semantic tokens (background, card, primary=lime, accent, muted, border, ring) + status tokens (info=cyan for AI, warning=amber for review, destructive=red for blocking risk). Dark navy only (no theme toggle, per current decision).
  - Replace the shell: `components/layout/{DashboardLayout,Sidebar,Header}` → collapsible sidebar, header with breadcrumbs, user menu (role + tenant) and ⌘K command palette for navigation. Keep `nav-items.ts` as the source of truth and keep react-router-dom (no TanStack Router).
  - Restyle existing screens with the new primitives, no behaviour change: Dashboard (KPI cards), Opportunities list (data table: sort, filter, pagination), Opportunity detail, Proposal builder, Package comparison, AI narrative editor (cyan AI badge), Approvals dashboard/detail (approve/reject via AlertDialog), Version comparison, ActivityTimeline, LoginScreen.
  - Map QD-402 `components/states/StateViews` to Skeleton/empty/error patterns and use toasts for mutation success/failure.
  - Proposal preview page: shared tokens only (stays client-facing and print-friendly, no app chrome).
  - Attribution: MIT notice for shadcn-admin in `THIRD_PARTY_NOTICES.md`.
- Not included: new screens from the template analysis (AI Review Desk, Templates, Team & roles, full Settings, tenant switcher). These go on follow-up cards if PO wants them post-v1.0. Also no API/schema changes, no TanStack Router or Clerk, no light theme, no chart library.

## Acceptance criteria
- [ ] All existing routes render inside the new shell. Sidebar collapses. Works at 375px with no horizontal scroll.
- [ ] ⌘K palette navigates to every nav item. Breadcrumbs reflect the current route.
- [ ] Lime is used only for primary actions and selected state. AI = cyan, review warnings = amber, blocking = red.
- [ ] Opportunities list uses the data table with working sort, filter and pagination (client-side).
- [ ] Approve/reject and other irreversible actions use AlertDialog confirmation. Mutations show toasts.
- [ ] No behaviour regressions: all existing Vitest suites pass (selectors updated only where markup changed, not assertions weakened).
- [ ] Keyboard navigable with visible focus rings. Dialogs trap focus. Text contrast is WCAG AA on navy.
- [ ] Unused template/demo code not imported. Bundle size increase noted in the work log.
- [ ] Before/after screenshots of Dashboard, Opportunities, Builder and Approval detail attached.

## Technical notes
- Expected modules/files: apps/web/package.json, src/index.css, src/lib/utils.ts, src/components/ui/*, src/components/layout/*, src/components/states/*, src/features/**/*.tsx (+ tests), components.json, THIRD_PARTY_NOTICES.md.
- Dependencies: QD-402 (states) in Done first, since both touch every screen and parallel work would conflict.
- Sequencing inside card (one commit each, green between): 1) tokens + ui primitives + cn, 2) shell + command palette, 3) dashboard + opportunities, 4) proposals + AI editor, 5) approvals + timeline + login, 6) a11y/responsive pass.
- Risks: large diff touching every screen (mitigate with the step commits above); test breakage from markup changes (prefer role/label queries); shadcn CLI upgrades may overwrite customised files (pin and review manually); template look (differentiate with tokens, not stock zinc).

## Test scenarios
### Happy path
Given the seeded Northstar manager is logged in, When they open ⌘K and select "Opportunities", Then the data table loads, sorting by "Last updated" reorders rows, and opening a row shows the detail page inside the new shell with correct breadcrumbs.
Given an approver on an approval detail, When they click Approve and confirm the AlertDialog, Then a success toast appears and the status badge updates.

### Failure/edge path
Given the API returns 500 on the opportunities list, When the page loads, Then the error state (QD-402) renders inside the shell with a retry action and no crash.
Given a 375px viewport, When the user opens the sidebar sheet and navigates, Then the sheet closes and no horizontal scroll appears.
Given an approver cancels the AlertDialog, Then no request is sent.

## AI evaluation (if relevant)
- N/A (visual only; AI badge colour change only)

## ADR / decisions
- Propose ADR-008 "UI foundation: shadcn/ui components owned in-repo, react-router retained" (PO approves)

## Evidence before Done
- [ ] Tests (vitest)
- [ ] Format/lint/typecheck/build
- [ ] Review (Gemini + impeccable critique/audit)
- [ ] Documentation (ADR-008, notices, screenshots)

## Amendments
- 2026-09-25: PO chose to start QD-409 while QD-402 is still in In Progress, accepting two cards over the WIP 1 limit. The QD-402 code was already committed on main (bb718ba) before the branch was created.
- 2026-09-25: The API's `Opportunity` has no timestamp field, so the "sorting by Last updated" scenario can't be built without an API change (out of scope). The data table sorts by title, customer and status instead.
- 2026-09-25 (Claude's decision in step 2, reported to the PO afterwards rather than asked first; review should flag it if the PO wants the dropdown): The Header keeps a visible "Log out" button (icon + accessible name) rather than a dropdown user menu, so the existing Header tests stay unchanged. Organisation and role show in the header on sm+ and in the mobile drawer below sm.
