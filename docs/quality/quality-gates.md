# Quality Gates

## Local
- Frontend: formatter, lint, TypeScript check, component tests with coverage (`npm run test:coverage`), production build.
- Backend: formatter, lint, type check, pytest with coverage (`pytest --cov`).
- Cross-cutting: migration check and the Playwright E2E suite when a workflow or UI changes (see below).

## CI (`.github/workflows/ci.yml`, every PR and push to main)
| Job | Gates |
|---|---|
| backend | `ruff format --check`, `ruff check`, `mypy`, `alembic upgrade head --sql`, `pytest --cov` (floor **96%**, `[tool.coverage.report]` in `apps/api/pyproject.toml`) |
| frontend | `format:check`, `lint`, `typecheck`, `test:coverage` (floors statements 73 / branches 79 / functions 70 / lines 74, `vite.config.ts`), `build` |
| secrets | gitleaks over the full git history |

Coverage summaries appear in the job summary and as `api-coverage` / `web-coverage` artifacts. Floors were set at introduction (QD-405) to measured coverage minus ~2 points; raise them as coverage grows, never lower them to pass.

A failed quality gate blocks a Trello move to AI/Human Review.

## E2E (`.github/workflows/e2e.yml`)
Playwright (Chromium) against the docker compose stack with seeded data and FakeProvider (no real AI):
- `golden-path.spec.ts`: manager builds the 3-package proposal (total $7,528.00) and finalizes → submit + approval request (API step until a UI exists) → approver approves → client preview shows total and disclaimer.
- `tenant-isolation.spec.ts`: a Northstar user gets 404 (API) and the not-found state (UI) for another tenant's opportunity.

The workflow also serves as the fresh-clone smoke (`docker compose up --build` from a clean checkout).

**Status: manual-only (`workflow_dispatch`) until the end of the sprint**, then it runs on every PR and blocks merges.

Run locally (stack up, then from `apps/web`):

```bash
docker compose exec api alembic upgrade head
docker compose exec api python -m scripts.seed_demo
docker compose exec api python -m scripts.seed_e2e
E2E_API_URL=http://localhost:${API_PORT:-8000} npm run e2e
```

When a UI change could affect these specs, follow the `e2e-sync` skill (`.claude/skills/e2e-sync/SKILL.md`).
