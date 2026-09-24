# ADR-007: Schema-validated drafting, not a separate evaluator

## Decision
AI narrative drafts are gated by structural validation, not a distinct "evaluator" service. The draft-generation call parses and validates the model's output against a fixed schema before it can reach a human; anything that fails validation is rejected outright, never shown as a draft. Human review (ADR-004) remains the only semantic judgment in the pipeline.

## Consequence
No agent grades or scores draft quality — a malformed or off-schema response is a hard failure (logged, surfaced as an error), not a lower-quality draft that reaches a reviewer. This keeps the trust boundary simple: either the model produced something structurally sound, or the user never sees it.

## Confirmed by QD-306
`parse_narrative_output()` (`apps/api/app/services/ai/narrative_service.py`) validates every generation result against the `NarrativeOutput` Pydantic schema and raises `NarrativeParsingError` (mapped to `502 Bad Gateway`) on any parse/validation failure — there is no separate evaluator component anywhere in the codebase. `Opportunity.brief_json` is captured (`PATCH /opportunities/{id}`) but not yet read by `build_prompt()`, and the QD-307 review/edit UI is not yet built — both are open follow-ups, not part of this decision.
