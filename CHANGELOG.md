# Changelog

All notable changes to QuoteDrive. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - Unreleased

The first complete release: the full proposal journey, from discovery notes to an approved, client-ready preview. The date is set at sign-off (QD-408).

### Added
- **Tenancy and access**: demo sign-in with four roles (Admin, Proposal Manager, Approver, Viewer). Every query is scoped to the caller's organization, and cross-tenant access returns 404 (QD-101, QD-102, QD-105).
- **Dashboard** with pipeline counts, pending approvals and an activity timeline (QD-103, QD-104, QD-304).
- **Customers and opportunities** API with search and filters (QD-201), and UI to search, create, edit and delete customers, create opportunities, edit their title and status, and see each opportunity's activity history (QD-413).
- **Catalogue** of synthetic packages and add-ons (QD-202).
- **Proposal builder** with live, server-calculated illustrative estimates (QD-203, QD-204) and a three-option package comparison (QD-206).
- **Immutable proposal versions**: finalize freezes a version, and edits fork a new one (QD-205).
- **Approval workflow**: approval requests, approve or request changes with a comment, no self-approval, and a version-to-version comparison (QD-301, QD-302).
- **Audit events** for every state change, with the actor's name captured at write time (QD-303).
- **AI drafting** behind a provider interface (OpenRouter, Ollama, FakeProvider): proposal narrative (QD-305–QD-308) and discovery brief (QD-404). Drafts are schema-validated, labelled for human review and never auto-saved.
- **Output guard** that rejects drafts containing figures not in the proposal data, or unsupported discount wording (QD-410).
- **Workspace settings › Members**: Admins list members and change roles; the last Admin can't be demoted, and every change is audited (QD-416).
- **Client-ready proposal preview** for approved versions, print-friendly (QD-401).
- **Loading, empty, error and forbidden states** across the app (QD-402).
- **UI foundation**: shadcn/ui components on Radix, a collapsible sidebar, breadcrumbs, a ⌘K command menu, confirmation dialogs and toasts (QD-409, ADR-008).
- **AI evaluation suite**: fixture cases run in CI with FakeProvider and can be re-run against a live model (QD-403).
- **Quality automation**: Playwright E2E (golden path and tenant isolation), coverage floors, and a gitleaks scan of the full history (QD-405).
- **Release documentation**: README, architecture and ER diagrams, reconciled API contract and data model, runbooks and an ADR index (QD-406).

### Fixed
- Correct AI narratives that stated the proposal total were rejected by the output guard, because the total was missing from the prompt data (QD-406).
- CI resolved SQLAlchemy 2.1, whose typing broke mypy; SQLAlchemy is now pinned to `<2.1`.

### Known limitations
See the README section [Known limitations and deferred scope](README.md#known-limitations-and-deferred-scope).
