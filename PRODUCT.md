# Product

## Register

product

## Users
Four roles inside a single-tenant B2B consultancy workspace (`docs/product/product-vision.md`, `docs/product/personas-and-user-journeys.md`):

- **Organization Admin** — configures the tenant workspace, catalogue, members, roles, feature settings.
- **Proposal Manager** — creates customers/opportunities, configures a proposal, drafts text, submits for approval.
- **Approver** — reviews a stable proposal version, approves or requests changes.
- **Viewer** — reads shared or approved proposals.

Context: professional users at a B2B mobility/consultancy firm, working through a governed proposal lifecycle (Draft → Configured → Proposal Drafted → Awaiting Approval → Approved → Shared → Won/Lost/Expired) during normal business hours on desktop/tablet. This is a workflow tool, not a casual browsing surface — users arrive with a specific task (configure a proposal, review one, approve one) and need to get it done accurately.

## Product Purpose
QuoteDrive turns structured discovery inputs, configurable service packages, and governed commercial assumptions into polished, reviewable, client-ready proposal drafts — replacing the spreadsheet/email/tribal-memory mess that causes inconsistent scope, weak version history, and slow approvals.

It's also an educational/portfolio case study: a credible React + FastAPI + PostgreSQL SaaS vertical slice demonstrating product thinking, tenant isolation, RBAC, controlled generative AI (drafts only, human-approved), and delivery discipline. Success looks like: workflow transitions/permissions/estimates/audit records are fully deterministic, AI provenance and fallback behavior are always visible, and the product reads as a polished generic-consultancy tool (not a flashy demo) built on a fictional fleet-mobility narrative.

## Brand Personality
Bold, modern, energetic — but grounded in the seriousness of governed commercial workflows. Dark navy base with lime accents (already fixed by the delivery spec) should read as confident and technical, not playful or consumer-startup. Energy comes from crisp contrast and purposeful accent color, not from decoration.

## Anti-references
Generic SaaS-cream template aesthetic: the cream/sand/paper near-white body background, gradient text, hero-metric cards, identical icon+heading+text card grids, tiny uppercase tracked eyebrows above every section. Also avoid anything that reads as a toy/demo rather than a credible enterprise tool — no gratuitous glassmorphism, no bouncy/elastic motion.

## Design Principles
1. **Deterministic and auditable over flashy.** Every workflow state, permission, and estimate the UI shows must be real and traceable — no fabricated numbers, no decorative dashboards that imply data that isn't there.
2. **Role and tenant context always visible.** The active organization and the user's role should be legible at a glance (this is literally what QD-103's header does) — this is a multi-tenant, RBAC-governed tool, and the UI should never let that be ambiguous.
3. **AI provenance and human review, never hidden.** Anywhere AI-drafted content appears, its origin and the human-approval step must be visible, per AGENTS.md's "AI drafts supplied facts only; requires human review."
4. **Portfolio-grade craft on a generic-consultancy template.** This is a demonstration piece — the fit and finish should read as a real product, not a prototype, while staying genuinely generic (fictional Northstar Mobility Advisory tenant, synthetic data only).
5. **Illustrative, not authoritative.** Every estimate/preview carries "Illustrative planning estimate only" — the design should never make a synthetic number look like a binding commercial commitment.

## Accessibility & Inclusion
Baseline requirements already fixed in `docs/product/non-functional-requirements.md`: keyboard-accessible controls, visible labels, visible focus states, semantic headings, and status text (not color alone) for state changes. Target WCAG 2.1 AA-equivalent contrast and interaction patterns throughout, consistent with those requirements.
