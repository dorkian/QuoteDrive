# QuoteDrive Specification Pack

QuoteDrive is an open-source educational case study for an AI-assisted, multi-tenant B2B proposal workspace. It is designed to demonstrate product thinking, SaaS architecture, controlled generative AI, tenant isolation, approval workflows, and delivery discipline.

## Product boundary
QuoteDrive is not a financial institution, lender, credit-scoring system, binding quote engine, legal tool, or compliance product. All companies, customers, commercial values, vehicles, and documents are fictional or synthetic. AI creates drafts only; people own commercial decisions and approvals. See `docs/product/synthetic-data-policy.md` for the full policy and `docs/product/demo-scenario.md` for the reference demo narrative.

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

## Local development

Prerequisites: Docker + Docker Compose, Node LTS, Python 3.12+ (see `docs/runbooks/local-development.md` for details).

```bash
docker compose up --build
```

- Web app: http://localhost:5173
- API: http://localhost:8000 (docs at `/docs`, health check at `/health`)

Run the database migration and seed the demo tenant/users (see `docs/product/demo-scenario.md`):

```bash
docker compose exec api alembic upgrade head
docker compose exec api python -m scripts.seed_demo
```

Then log in as any demo user, e.g. `POST /auth/demo-login {"email": "admin@northstar.example"}`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request targeting `main`, with two independent jobs that must both pass before a PR can merge:

- **backend** (`apps/api`): `ruff format --check`, `ruff check`, `mypy`, `alembic upgrade head --sql` (validates migrations offline, no live DB needed), `pytest --cov` (floor 96%).
- **frontend** (`apps/web`): `npm ci`, `prettier --check`, `oxlint`, `tsc -b`, `vitest run --coverage` (floors in `vite.config.ts`), `vite build`.
- **secrets**: gitleaks over the full history.
- **E2E** (Playwright, manual-only for now): see `docs/quality/quality-gates.md`.

Each job runs its checks as sequential steps, so the first failing check stops that job immediately rather than masking later failures. Run the same commands locally before pushing to catch issues early.
