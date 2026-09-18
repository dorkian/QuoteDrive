# AI Provider Architecture

## Provider contract
`GenerationProvider.generate(request) -> GenerationResult`

Adapters:
- `OpenRouterProvider`: primary remote inference.
- `OllamaProvider`: optional local fallback.
- `FakeProvider`: deterministic test provider; used in CI.

## Request flow
1. Authorize user and tenant; validate feature flag/quota.
2. Validate structured input against a Pydantic schema.
3. Call OpenRouter.
4. Retry one transient failure at most once.
5. If allowed and available, call Ollama after primary technical failure.
6. Persist provider/model/prompt version/status/latency/fallback cause.
7. Return editable draft with visible provenance.

## Prohibited output behavior
The model may not invent prices, discounts, terms, dates, guarantees, legal language, product capabilities, financing conditions, or workflow approvals. Unknown fields become explicit open questions.
