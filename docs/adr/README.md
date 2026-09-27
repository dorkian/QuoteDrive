# Architecture Decision Records

Decisions are proposed by the implementer and approved by the Product Owner. The status column says how far each decision is implemented in v1.0.0.

| ADR | Decision | Status | Implemented in v1.0.0 |
|---|---|---|---|
| [ADR-001](ADR-001-modular-monolith.md) | One FastAPI modular monolith and one Postgres database | Accepted | Yes |
| [ADR-002](ADR-002-shared-database-tenancy.md) | Shared tables with mandatory `organization_id`; cross-tenant access returns 404 | Accepted | Yes. Tenant-isolation tests and E2E. |
| [ADR-003](ADR-003-deterministic-estimates.md) | Estimates are calculated on the server, never by AI | Accepted | Yes |
| [ADR-004](ADR-004-human-in-the-loop-ai.md) | AI drafts, humans decide | Accepted | Yes. Drafts are never persisted by AI endpoints. |
| [ADR-005](ADR-005-provider-abstraction.md) | Provider interface: OpenRouter primary, Ollama optional fallback, FakeProvider for tests | Accepted | **Partly.** All three adapters exist and one provider is chosen by configuration; automatic, visible fallback is not built. |
| [ADR-006](ADR-006-proposal-versioning.md) | Immutable proposal version snapshots; edits fork a new version | Accepted | Yes |
| [ADR-007](ADR-007-schema-validated-drafting.md) | Drafts gated by schema validation, not an evaluator service | Accepted | Yes, plus a deterministic output guard (QD-410). |
| [ADR-008](ADR-008-ui-foundation-shadcn.md) | In-repo shadcn/ui components on Radix; react-router retained | **Proposed**, awaiting PO approval | Yes (QD-409) |

## Adding an ADR
Copy the format of an existing file (Decision, Rationale or Context, Consequence), number it sequentially, add it to this table with status **Proposed**, and link it from the card that needs it. Only the Product Owner changes the status to Accepted.
