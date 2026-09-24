# AI narrative pipeline

How a proposal's structured content becomes an AI-drafted narrative, and what stands between a generated draft and a human decision. See [ADR-007](../adr/ADR-007-schema-validated-drafting.md) for the governing decision and [ADR-004](../adr/ADR-004-human-in-the-loop-ai.md) for the human-review requirement this pipeline implements.

**Diagram:** https://claude.ai/artifact/5LkZoaCzo2xWLgWj7NWs7R

## The pipeline, as it actually exists today

1. **Proposal content** — package lines, quantities, and per-line assumptions live on `ProposalVersion.content_json`, built up through the existing proposal-configuration flow (`apps/api/app/api/proposal_versions.py`).
2. **Generate draft** — `POST /ai/proposal-narrative` (`apps/api/app/api/ai.py`) takes a `proposal_version_id` and re-fetches `Customer`/`Opportunity`/`ProposalVersion` server-side rather than trusting a client-supplied payload, then calls a `GenerationProvider` (OpenRouter, Ollama, or Fake — `apps/api/app/services/ai/providers/`, QD-305) via `generate_narrative()` (`apps/api/app/services/ai/narrative_service.py`, QD-306).
3. **Validation gate** — `parse_narrative_output()` validates the model's response against the `NarrativeOutput` Pydantic schema (`apps/api/app/schemas/ai.py`). This is the pipeline's real "evaluator": a structural check, not a semantic one. Anything that fails to parse is rejected (`502`), never shown to a user, per [ADR-007](../adr/ADR-007-schema-validated-drafting.md).
4. **Generation log** — every attempt, successful or not, is recorded to `generation_logs` (provider, model, latency, status) with `actor_name` snapshotted at write time, mirroring the pattern `audit_events` uses for the same reason (a later profile rename shouldn't rewrite history).
5. **Disclaimer** — the app itself attaches "Draft AI Content — Requires human review" to every response; the model never controls this text.
6. **Submit → approval** — proposal submission and the `ApprovalRequest` lifecycle (`pending → approved / changes_requested`) are the existing, already-shipped QD-301/QD-302 workflow. Human decision remains the only semantic judgment anywhere in this pipeline.

## Two gaps, not smoothed over

- **`Opportunity.brief_json` isn't wired into drafting.** It's captured (`PATCH /opportunities/{id}`) and stored, but `build_prompt()` never reads it — the narrative prompt is built only from customer, opportunity title, proposal content, and an optional `timeline` string. The mission's "brief → extraction" step doesn't exist as a real connection yet.
- **No review UI yet.** QD-307 (narrative editor, provider badge, edit/save) is still unbuilt. Concretely, this also means a generated draft isn't persisted anywhere today — `POST /ai/proposal-narrative` returns it, but nothing writes it back onto the `ProposalVersion` until QD-307 ships a save action.

## Why there's no separate "evaluator" service

Nothing in the codebase grades or scores a draft's quality. The only gate is structural: does the model's JSON match the expected schema? A draft that parses reaches a human for real judgment; one that doesn't is a hard failure, not a low-quality draft shown anyway. See [ADR-007](../adr/ADR-007-schema-validated-drafting.md).
