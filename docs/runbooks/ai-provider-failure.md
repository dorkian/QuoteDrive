# AI Provider Failure Runbook

AI drafting ([ADR-004](../adr/ADR-004-human-in-the-loop-ai.md)) never blocks the workflow. A failed generation leaves the existing proposal, narrative and brief unchanged, and the user can retry or write the text themselves.

## What the user sees
Every failure shows the same message, "Couldn't draft …", with a **Retry** button. The API status tells you which case it is:

| API status | Typical cause |
|---|---|
| 502 | Provider error; output that fails the JSON schema; output rejected by the output guard (invented figure or unsupported discount wording). |
| 504 | The model is too slow for `AI_REQUEST_TIMEOUT_SECONDS`. |
| 500 | `AI_PROVIDER=openrouter` without `OPENROUTER_API_KEY`, or a rejected key. |
| 400 | Narrative requested for a version with no lines. |

## Diagnose
1. Find the failed attempt. Every attempt writes a `generation_logs` row with the provider, model, status, latency and `error_detail`:
   ```bash
   docker compose exec db psql -U quotedrive -d quotedrive -c \
     "select created_at, entity_type, entity_id, provider, model, status, left(error_detail, 120) from generation_logs order by id desc limit 5"
   ```
2. Read `error_detail`:
   - `Output guard: ...`: the model invented a figure or discount wording. The guard did its job; retry, or write the text yourself.
   - `Failed to parse ...`: the output was not valid JSON for the schema. Retry; a weak model may need a stronger one.
   - `Ollama returned status 404: model '...' not found`: pull the model or set `OLLAMA_MODEL` to one from `ollama list`.
   - `timeout`: raise `AI_REQUEST_TIMEOUT_SECONDS` (local 7B models often need 120) or use a faster model.
   - With `AI_PROVIDER=fake`, every draft fails by design: FakeProvider returns canned test text. Configure a real provider (see [local-development.md](local-development.md)).
3. Check the provider directly:
   - Ollama: `curl http://localhost:11434/api/tags`.
   - OpenRouter: check the key and the provider's status page.
4. After changing `.env`, apply it with `docker compose up -d api`.

## Rules
- Retry manually. There is no automatic retry and no automatic fallback between providers: one provider is configured at a time ([ADR-005](../adr/ADR-005-provider-abstraction.md) plans fallback, but it is not built).
- Never log or paste prompts, outputs or API keys into tickets. `generation_logs` stores metadata only.
- A failed generation must not change proposal workflow state.
