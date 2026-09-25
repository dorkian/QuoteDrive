# Review: QD-409 UI foundation: adopt Shadcn Admin shell + components (navy/lime), restyle existing screens

**Verdict:** FAIL
**Reviewed against:** specs/qd-409-ui-foundation.md
**Reviewed:** 2026-09-25, branch `feat/ui-foundation` at `eeabe2d` (base `bb718ba`)

## Failing items

### Acceptance criteria: "Lime is used only for primary actions and selected state."
- **Status:** partially met
- **What's wrong:** Lime (`primary`) is also used for things that are neither actions nor selection:
  - the "Q" logo mark: `bg-primary` in `apps/web/src/components/layout/Sidebar.tsx` (logo span) and `apps/web/src/features/auth/LoginScreen.tsx` (logo span);
  - the decision-success icon: `text-primary` on `CircleCheck` in `apps/web/src/features/approvals/ApprovalDetail.tsx` (success banner);
  - an unused `primary` variant (`border-lime-400/30 bg-lime-400/10 text-lime-300`) in `apps/web/src/components/ui/badge.tsx` that invites future misuse.
- **Fix needed:** Change both logo marks to a neutral treatment (e.g. `bg-foreground text-background`, or `border border-border bg-card text-foreground`). Change the success icon to `text-foreground` or `text-muted-foreground`. Delete the `primary` variant from `badgeVariants` in `badge.tsx`. Then run `grep -rn "primary\|lime-" apps/web/src --include=*.tsx`: the only remaining hits should be buttons, the active sidebar item, focus rings, link hover, the checked checkbox `accent-lime-400`, and the preview page's primary buttons.

### Scope: "Map QD-402 StateViews to Skeleton/empty/error patterns and use toasts for mutation success/failure."
- **Status:** partially met
- **What's wrong:** Two mutations have no toast:
  - `handleCreateDraft` in `apps/web/src/features/opportunities/OpportunityDetailPage.tsx`: no toast on success or on failure (only the inline `actionError`).
  - `handleGenerate` in `apps/web/src/features/proposals/AiNarrativeEditor.tsx`: toasts on success, but the `catch` branch never calls `toast.error`.
- **Fix needed:** In `OpportunityDetailPage.handleCreateDraft`, call `toast.success(\`Draft version ${version.version_number} created\`)` before `navigate(...)`, and `toast.error(message)` in the catch alongside `setActionError`. In `AiNarrativeEditor.handleGenerate`'s catch, call `toast.error(described.message)`. Import `toast` from `"sonner"` in both files. The existing tests need no change (toasts are no-ops without a mounted `<Toaster />`).

### Scope: "Add shadcn/ui primitives ... (button, card, badge, table, tabs, dialog, alert-dialog, sheet, dropdown-menu, select, input, textarea, tooltip, breadcrumb, skeleton, sonner toast, command)."
- **Status:** partially met
- **What's wrong:** `tabs`, `select`, `dropdown-menu` and `tooltip` are not in `apps/web/src/components/ui/`. `dropdown-menu` and `tooltip` were added in step 1 and deleted in step 6 as unused. `tabs` and `select` were never added. The build report explains this with the "unused template/demo code not imported" criterion, but no amendment in the spec covers it, so the spec's own list and the delivered set disagree.
- **Fix needed:** This is a spec conflict, so the build must stop and ask the PO before changing code (build skill Step 4). Either (a) the PO approves dropping them: add an Amendment line to `specs/qd-409-ui-foundation.md` ("tabs, select, dropdown-menu, tooltip not added because no QD-409 screen uses them; add when a screen needs one"), or (b) the PO wants them: restore `dropdown-menu.tsx` and `tooltip.tsx` from commit `6c271aa`, add `tabs.tsx` and `select.tsx` on `@radix-ui/react-tabs` / `@radix-ui/react-select`, and reinstall those packages.

### Acceptance criteria: "Before/after screenshots of Dashboard, Opportunities, Builder and Approval detail attached."
- **Status:** partially met
- **What's wrong:** All 8 PNGs exist in `docs/screenshots/qd-409/` (before = production build of `bb718ba`, after = `eeabe2d`) and the Trello work log points to that folder, but they are not attached to the QD-409 card. The Trello tools available to Claude can't upload attachments.
- **Fix needed:** The PO attaches the 8 files from `docs/screenshots/qd-409/` to the QD-409 card, or amends the criterion to "committed under docs/screenshots/qd-409/ and linked from the work log".

### Evidence before Done: "Review (Gemini + impeccable critique/audit)" and ADR: "Propose ADR-008 ... (PO approves)"
- **Status:** not met (waiting on people, not code)
- **What's wrong:** The impeccable audit was run (detector 0 findings, P2s fixed in `eeabe2d`). The Gemini review has not been run, and `docs/adr/ADR-008-ui-foundation-shadcn.md` has status "Proposed" with no PO approval.
- **Fix needed:** No build action. PO runs the Gemini review on the branch and approves or edits ADR-008. The build then fixes any confirmed Blocking/Important Gemini findings.

## Items verified as met (for the record)
- Tokens: semantic navy/lime/cyan/amber/red tokens in `src/index.css`, dark only. Checked by reading, and live computed styles resolved `--color-ring` to lime.
- Shell: collapsible sidebar (live: 240 → 64 px, persists), mobile sheet closes on navigation (live), breadcrumbs match the route (`breadcrumbs.test.ts` + live), ⌘K palette built from `NAV_ITEMS` (`CommandMenu.test.tsx` + live). react-router kept, `nav-items.ts` is the source of truth.
- User menu: satisfied by the amended spec (visible Log out + org/role in header and drawer). The amendment is Claude's own decision and is flagged there for PO confirmation.
- All existing routes render inside the shell with no horizontal scroll at 375/768/1280 (live sweep of 10 routes).
- Opportunities data table: sort ↑↓, search, status filter, pagination (`OpportunitiesTable.test.tsx`, 4 tests; live search at 375). The "sort by Last updated" scenario is covered by an amendment.
- Irreversible actions confirm in an AlertDialog: finalize, approve, request changes. Cancel sends nothing: 2 tests + live network log showed no POST. Focus starts on Cancel and is trapped (live).
- No weakened assertions: test diff vs `bb718ba` changes only selectors (`"pending"`→`"Pending"`, `getByText`→`getByRole` group/cell), adds one confirm click, and adds new tests. 102/102 tests pass.
- WCAG AA contrast: computed ratios for all text tokens on navy-950/900/800 are ≥4.62:1 after the navy-400 change. Focus rings: lime 2px outline, checked live.
- Unused template code not imported. Bundle increase recorded (97.41 → 139.11 kB gzip).
- Failure edge case: API 500 on the opportunities list shows the QD-402 error state with "Try again" inside the shell (triggered live by stubbing `fetch`).
- Preview page: tokens only, `print:` classes unchanged (read diff). THIRD_PARTY_NOTICES.md present.
- Approve happy path "success toast appears and status badge updates": verified by reading `handleApprove` (toast.success + `setRequest` merge feeding `StatusBadge`). Not run live, because approving would change real demo data.

## Scope creep noted (not a failure)
- Finalize confirmation dialog (step 4). The spec says "other irreversible actions use AlertDialog", so this is arguably in scope, but it changed an existing test's flow.
- `StatusBadge` + `formatStatus` changed status text from raw `snake_case` to sentence case across screens.
- Removed the stale "Approvals tracking arrives once the proposal workflow ships" dashboard note.
- Native search clear-button restyle in `index.css`.
- Dashboard "Total" KPI card, a new derived number (sum of per-status counts).
