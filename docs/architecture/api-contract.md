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
- `POST /ai/discovery-brief`
- `GET /audit-events?entity_type=&entity_id=&limit=&before_id=` (includes `actor_name` via User join)

No endpoint accepts a client-trusted tenant ID for authorization.
