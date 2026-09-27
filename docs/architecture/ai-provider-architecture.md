# AI Provider Architecture

## Provider contract
`GenerationProvider.generate(request) -> GenerationResult`

Adapters (`apps/api/app/services/ai/providers/`):
- `OpenRouterProvider`: hosted models.
- `OllamaProvider`: local models.
- `FakeProvider`: deterministic, no network. The default, and used in CI.

Exactly one provider is active, chosen by `AI_PROVIDER` (`fake` | `openrouter` | `ollama`). [ADR-005](../adr/ADR-005-provider-abstraction.md) plans OpenRouter-primary with a visible Ollama fallback; **automatic fallback and retry are not built in v1.0.0**.

## Request flow (as built)
Used by `POST /ai/proposal-narrative` and `POST /ai/discovery-brief`:
1. Authorize the user's role (Admin or Proposal Manager) and load the record in the caller's tenant (404 otherwise).
2. Build the prompt. Untrusted data (proposal content, notes) goes inside delimiters, and the instruction to treat it as data is restated after it.
3. Call the configured provider once.
4. Parse the output against the Pydantic schema; failure returns 502 ([ADR-007](../adr/ADR-007-schema-validated-drafting.md)).
5. Run the output guard (`output_guard.py`): reject figures that are not in the source data, and discount or percentage wording the priced lines don't support. Rejection returns 502.
6. Write a `generation_logs` row with provider, model, prompt version, status, latency and error detail, for success and failure alike.
7. Return the draft with a disclaimer and provenance. Nothing is persisted until a person saves it.

Failure handling is in [ai-provider-failure.md](../runbooks/ai-provider-failure.md).

## Prohibited output behavior
The model may not invent prices, discounts, terms, dates, guarantees, legal language, product capabilities, financing conditions, or workflow approvals. Unknown fields become explicit open questions.
