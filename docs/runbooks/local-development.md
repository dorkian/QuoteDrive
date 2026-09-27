# Local Development Runbook

## Prerequisites
- Docker with Docker Compose, and Git. This is enough to run the app.
- Node 20 and Python 3.12 with [uv](https://docs.astral.sh/uv/), only to run tests and linters outside Docker.
- Optional: [Ollama](https://ollama.com) for free local AI drafts.

## Start the stack
```bash
docker compose up -d --build
docker compose exec api alembic upgrade head
docker compose exec api python -m scripts.seed_demo
```
- Web: http://localhost:5173. Pick a demo user; see [demo-scenario.md](../product/demo-scenario.md).
- API: http://localhost:8000, with interactive docs at `/docs` and a health check at `/health`.

Seeding is idempotent, so running it again is safe. For the E2E tenant-isolation test, also run `docker compose exec api python -m scripts.seed_e2e`, which adds a second fictional tenant.

The images have **no source mounts**: after changing code, rebuild with `docker compose up -d --build api web`.

## Configuration
Copy `.env.example` to `.env`. Never commit `.env`; it is git-ignored.

| Setting | Default | Notes |
|---|---|---|
| `API_PORT` / `WEB_PORT` | 8000 / 5173 | If you change `API_PORT`, also set `VITE_API_URL=http://localhost:<port>` in `apps/web/.env` and rebuild `web`. The API only accepts browser requests from `http://localhost:5173`, so keep `WEB_PORT` at 5173. |
| `AI_PROVIDER` | `fake` | `fake` calls no model, so "Generate draft" shows a handled error. `ollama` or `openrouter` give real drafts. |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | `http://host.docker.internal:11434` / `llama3` | Use a model you have pulled (`ollama list`); `llama3` returns 404 if it is missing. |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | empty / `openai/gpt-4o-mini` | Required when `AI_PROVIDER=openrouter`. |
| `AI_REQUEST_TIMEOUT_SECONDS` | 30 | Local 7B models often need 120. |

After editing `.env`, run `docker compose up -d api` to apply it.

## Tests and checks outside Docker
```bash
# API (from apps/api)
uv sync --extra dev
uv run ruff format --check . && uv run ruff check . && uv run mypy app tests scripts migrations
uv run pytest --cov

# Web (from apps/web)
npm ci
npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run build

# E2E, with the stack up and seeded (from apps/web)
npx playwright install chromium
E2E_API_URL=http://localhost:${API_PORT:-8000} npm run e2e
```
Tests use FakeProvider and need no API key. See [quality-gates.md](../quality/quality-gates.md) for what CI enforces.

## Troubleshooting
| Symptom | Cause and fix |
|---|---|
| `Bind for 0.0.0.0:8000 failed: port is already allocated` | Another app uses the port. Set `API_PORT` in `.env` and `VITE_API_URL` in `apps/web/.env`, then rebuild `web`. |
| Web loads but every call fails (CORS error in the browser console) | The web app is not on `http://localhost:5173`, or `VITE_API_URL` points at the wrong port. |
| A code change doesn't show up | The images have no source mounts. Run `docker compose up -d --build api web`. |
| "Couldn't draft…" on every AI call | `AI_PROVIDER=fake`, a missing Ollama model, or a timeout. See [ai-provider-failure.md](ai-provider-failure.md). |
