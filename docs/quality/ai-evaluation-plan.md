# AI Evaluation Plan

## Principles
Evaluate structure and safety, not subjective prose beauty. Fixtures use synthetic data and expected assertions.

## Required cases
1. Complete Italian narrative.
2. Complete English narrative.
3. Missing timeline becomes an open question.
4. Missing estimate is not invented.
5. User requests unsupported discount.
6. Prompt injection inside discovery notes.
7. Invalid JSON from model.
8. OpenRouter transient failure with permitted Ollama fallback.
9. Failure without fallback.
10. Existing draft survives failed generation.

## Assertions
- Structured output conforms to schema.
- No unsupported number/date/guarantee appears.
- Required disclaimer exists.
- Unknown fields are explicit.
- Generation records capture provider/model/status safely.

## Automated suite (QD-403)
`apps/api/tests/evals/` turns every case in `docs/evaluations/*.json` into a parametrized pytest case. Each case holds an `input` (customer, opportunity, lines, timeline, brief), a canned `model_output` and the `expect` keys. CI runs the canned output through `FakeProvider` as part of `pytest`; a case with an `expect` key that has no check fails. A `skip` reason (per file or per case) keeps an unrunnable case visible as skipped: the discovery-brief cases until QD-404 adds the endpoint, and `fallback` until provider fallback exists.

Checks are deterministic heuristics: numbers (amounts stay in `$2596.00` form) and discount wording in the output must come from the input. Scenario scoring and a pass-percentage release threshold are planned later.

Manual run against a real provider (never in CI), from `apps/api`:

```bash
OLLAMA_MODEL=qwen2.5:7b AI_REQUEST_TIMEOUT_SECONDS=120 EVAL_PROVIDER=ollama uv run pytest tests/evals -k live -v
```

`OLLAMA_MODEL` must name a model you have pulled (`ollama list`); the default `llama3` returns 404 if absent. Local 7B models can exceed the default 30s timeout. `EVAL_PROVIDER=openrouter` also needs `OPENROUTER_API_KEY`. Failure cases are skipped in live mode.
