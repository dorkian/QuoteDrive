# QuoteDrive Specification Pack

QuoteDrive is an open-source educational case study for an AI-assisted, multi-tenant B2B proposal workspace. It is designed to demonstrate product thinking, SaaS architecture, controlled generative AI, tenant isolation, approval workflows, and delivery discipline.

## Product boundary
QuoteDrive is not a financial institution, lender, credit-scoring system, binding quote engine, legal tool, or compliance product. All companies, customers, commercial values, vehicles, and documents are fictional or synthetic. AI creates drafts only; people own commercial decisions and approvals.

## Delivery model
- Trello is the delivery cockpit.
- Repository documentation is the technical source of truth.
- Claude Code implements one approved card at a time.
- Gemini independently reviews plans, diffs, risks, and AI evaluation coverage.
- Copilot refines backlog items and assists with small, bounded work.
- The Product Owner/Tech Lead approves architecture decisions and moves accepted work to Done.

## Roadmap
Four weekend milestones take the project from foundation to portfolio release: monorepo/tenant scaffolding, configurable proposals with illustrative estimates, controlled AI drafting with human approval, then hardening and a client-ready preview. Billing, email sending, PDF rendering, SSO, third-party integrations, real marketplace data, public deployment, and autonomous workflow agents are explicitly deferred. See `docs/product/mvp-scope-and-roadmap.md` for the full breakdown.

Read `docs/product/product-vision.md` first, then `docs/delivery/trello-board-spec.md` and `AGENTS.md`.
