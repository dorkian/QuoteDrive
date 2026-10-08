# Changelog

All notable changes to QuoteDrive. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - Unreleased

The first complete release: the full proposal journey, from discovery notes to an approved, client-ready preview. The date is set at sign-off (QD-408).

### Added
- **Tenancy and access**: demo sign-in with four roles (Admin, Proposal Manager, Approver, Viewer). Every query is scoped to the caller's organization, and cross-tenant access returns 404 (QD-101, QD-102, QD-105).
- **Dashboard** with pipeline counts, pending approvals and an activity timeline (QD-103, QD-104, QD-304). It is now an interactive one-screen view: KPI tiles with weekly trend lines (open pipeline, win rate, awaiting approval, median approval time, AI draft health), a weekly activity chart with crosshair tooltip and series toggles, a proposal-pipeline funnel, an outcomes donut with win rate, a package mix, and the recent-activity panel. A 4-week, 12-week and all-time range applies to every chart. Hand-built SVG, no chart library; each chart has keyboard access and a table view. New `GET /dashboard/analytics` (read-only, tenant-scoped) and an optional `scripts.seed_demo_history` that adds fifteen fictional customer stories.
- **Customers and opportunities** API with search and filters (QD-201), and UI to search, create, edit and delete customers, create opportunities, edit their title and status, and see each opportunity's activity history (QD-413).
- **Catalogue** of synthetic packages and add-ons (QD-202).
- **Proposal builder** with live, server-calculated illustrative estimates (QD-203, QD-204) and a three-option package comparison (QD-206).
- **Immutable proposal versions**: finalize freezes a version, and edits fork a new one (QD-205).
- **Approval workflow**: approval requests, approve or request changes with a comment, no self-approval, and a version-to-version comparison (QD-301, QD-302).
- **Audit events** for every state change, with the actor's name captured at write time (QD-303).
- **AI drafting** behind a provider interface (OpenRouter, Ollama, FakeProvider): proposal narrative (QD-305–QD-308) and discovery brief (QD-404). Drafts are schema-validated, labelled for human review and never auto-saved.
- **Output guard** that rejects drafts containing figures not in the proposal data, or unsupported discount wording (QD-410).
- **Workspace settings › Members**: Admins list members and change roles; the last Admin can't be demoted, and every change is audited (QD-416).
- **Workspace settings › Catalogue**: Admins add, edit, deactivate and reactivate packages and add-ons. Inactive items can't be quoted; saved versions keep their prices (QD-415).
- **Submit for approval** from the version page: pick an Admin or Approver (never the version's creator) and submit in one step. If assigning fails after the submit, an "Assign approver" button finishes it. New `GET /proposal-versions/{id}/approvers` lists who can be assigned (QD-412).
- **Share and outcome**: mark an approved version as shared, then record Won, Lost or Expired; Won and Lost close the opportunity, and the dashboard counts outcomes (QD-414).
- **AI retry and fallback** (ADR-005): one retry on a transient provider failure, then an opt-in (Settings › AI) fallback to local Ollama. Drafts and `generation_logs` record the fallback reason; eval cases 8 and 9 run in CI (QD-417).
- **AI eval scoring** (QD-418): live runs score every check, repeat each scenario 3 times, write a report to `docs/evaluations/reports/` and fail below a 90% pass percentage or on any safety failure. The output guard accepts negated discount wording such as "No discount is offered".
- **UX overhaul** (design brief confirmed 2026-10-08):
  - One status colour system with icons and labels for opportunities, proposal versions, approvals and customers, shared by tables, panels and charts.
  - One `DataTable` for Opportunities, Customers and Approvals: sortable, searchable, filter chips with counts, a visible View button, and click-anywhere rows. Opportunities show stage, latest proposal, monthly estimate, owner and last activity; Customers show open pipeline; Approvals show how long a request has waited and flag overdue ones.
  - Details open without leaving the list, and stay in the URL so Back closes them and a link reopens them. Opportunities open in a side panel with a "Next step" card that always says what to do next; customers open in a centred modal. Opening an opportunity from a customer stacks its panel on top of the modal, on the same page, and Esc peels one layer at a time.
  - Breadcrumbs show real names; the client preview has the full navigation bar (hidden when printing).
  - AI discoverability: a five-step journey stepper in the proposal builder, "Draft with AI" wording, an explanation next to the AI buttons, and an AI-first empty discovery brief.
  - First-visit guide: a skippable, role-aware product tour, dismissible tips on the main screens, and a Help menu to replay both. No new dependency.
  - Additive API fields: owner, value and activity on opportunities, opportunity counts and pipeline on customers.
  - **Finishing touches**: thin dark scrollbars across the app, a customer modal that is wide enough for its numbers and scrolls only its opportunity list, a macOS-style open and close animation for modals (reduced motion respected), and drawn logo marks for the 16 fictional demo customers (`apps/web/scripts/make_logos.py`).
  - **Customer profiles**: a generated logo mark (no uploads, no real brands), website, headquarters, company size, about, industry tags and a primary contact. The customer modal is now a profile page: header with tags, an About and links sidebar, a contact card with Email and Copy, four stat cards, and Opportunities and Activity tabs. The table shows location and size and searches the whole profile. Migration `c9d4e7a1f2b8` adds nine nullable columns. The profile (never the contact's email) also feeds the discovery-brief and narrative prompts, so drafts use the customer's industry, size and contact name; the output guard still rejects invented figures. `seed_demo_history` fills fictional profiles for all 16 demo customers and is safe to re-run.
- **Synthetic-data notice** in the app footer, on the sign-in screen and on the client preview.
- **Client-ready proposal preview** for approved versions, print-friendly (QD-401).
- **Loading, empty, error and forbidden states** across the app (QD-402).
- **UI foundation**: shadcn/ui components on Radix, a collapsible sidebar, breadcrumbs, a ⌘K command menu, confirmation dialogs and toasts (QD-409, ADR-008).
- **AI evaluation suite**: fixture cases run in CI with FakeProvider and can be re-run against a live model (QD-403).
- **Quality automation**: Playwright E2E (golden path and tenant isolation), coverage floors, and a gitleaks scan of the full history (QD-405).
- **Release documentation**: README, architecture and ER diagrams, reconciled API contract and data model, runbooks and an ADR index (QD-406).

### Fixed
- Dashboard "Recent activity": **Load more** grew the whole page. The list now stays in a fixed-height panel that scrolls on its own (no visible scrollbar, soft edge fades, keyboard-focusable) and glides to the first new event.
- Demo sign-in buttons were exposed to assistive technology as list items; they are now plain buttons (QD-419).
- Correct AI narratives that stated the proposal total were rejected by the output guard, because the total was missing from the prompt data (QD-406).
- CI resolved SQLAlchemy 2.1, whose typing broke mypy; SQLAlchemy is now pinned to `<2.1`.

### Known limitations
See the README section [Known limitations and deferred scope](README.md#known-limitations-and-deferred-scope).
