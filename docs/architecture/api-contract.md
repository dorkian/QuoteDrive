# API Contract (MVP)

## Conventions
- REST JSON under `/api/v1`.
- Authenticated context identifies the active organization.
- Errors use `{ "code": "...", "message": "...", "details": [] }`.

## Core endpoints
- `POST /auth/demo-login`
- `GET /me`
- `GET|POST /customers`
- `GET|PATCH /customers/{id}`
- `GET|POST /opportunities`
- `GET|PATCH /opportunities/{id}`
- `GET /catalogue/items`
- `POST /opportunities/{id}/versions`
- `GET /proposal-versions/{id}`
- `POST /proposal-versions/{id}/submit`
- `POST /proposal-versions/{id}/approval-request`
- `GET /approval-requests`
- `GET /approval-requests/{id}`
- `POST /approval-requests/{id}/approve`
- `POST /approval-requests/{id}/request-changes`
- `POST /ai/proposal-narrative`
- `POST /ai/discovery-brief` — `{opportunity_id, notes}` → draft `{summary, requirements[], open_questions[], unknowns[], disclaimer, provider, model}`. Never persisted; the reviewed brief is saved via `PATCH /opportunities/{id}` (`brief_json`), which records the audit event. Admin/Proposal Manager only; failures 502/504 like the narrative endpoint.
- `GET /audit-events?entity_type=&entity_id=&limit=&before_id=` (includes `actor_name`, snapshotted at write time)

No endpoint accepts a client-trusted tenant ID for authorization.
