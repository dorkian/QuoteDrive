# API Contract (v1.0.0)

Reconciled with the running API's OpenAPI schema on 2026-09-26 (QD-406). The interactive, always-current version is at `http://localhost:8000/docs`.

## Conventions
- REST JSON at the root path (no `/api/v1` prefix).
- Authentication: `Authorization: Bearer <token>` from `POST /auth/demo-login`. The token identifies the user; the active organization comes from their membership, never from the request body.
- Errors use FastAPI's shape: `{ "detail": "<message>" }` (validation errors: `{ "detail": [ ... ] }`).
- Cross-tenant access returns **404**, not 403, so a caller cannot learn that another tenant's record exists.
- Roles: A = Admin, PM = Proposal Manager, Ap = Approver, V = Viewer.

## Endpoints

| Method and path | Roles | Notes |
|---|---|---|
| `POST /auth/demo-login` | public | `{email}` → `{access_token}`. Demo sign-in, local use only. |
| `GET /me` | all | User, organization and role. |
| `GET /health` | public | Liveness check. |
| `GET /dashboard/summary` | all | `opportunities_by_status` and `proposal_versions_by_status` counts. |
| `GET\|POST /customers` | read: all · write: A, PM | Filter `q`: case-insensitive name search. Sorted by name. |
| `GET\|PATCH\|DELETE /customers/{id}` | read: all · write: A, PM | DELETE returns 409 while opportunities reference the customer. |
| `GET\|POST /opportunities` | read: all · write: A, PM | Filters: `customer_id`, `owner_id`, `status`. |
| `GET\|PATCH\|DELETE /opportunities/{id}` | read: all · write: A, PM | PATCH `brief_json` saves a reviewed discovery brief and records an audit event. |
| `GET /catalogue/items` | all | Active packages and add-ons for the tenant. `include_inactive=true` also returns inactive items (A only; 403 otherwise). |
| `POST /catalogue/items` | A | `{type: package\|add_on, name, category, base_monthly_estimate ≥ 0 (2 decimals), active?}`. Audited. |
| `PATCH /catalogue/items/{id}` | A | Name, category, price, `active`. `type` can't change. No delete: deactivate instead; saved versions keep their snapshot. Audited. |
| `POST /estimates/calculate` | A, PM | Stateless illustrative estimate for a set of lines, with disclaimer. |
| `GET\|POST /opportunities/{id}/versions` | read: all · write: A, PM | POST with optional `from_version_id` forks a new draft from any version. |
| `GET\|PATCH /proposal-versions/{id}` | read: all · write: A, PM | PATCH lines only while `draft`/`configured`; otherwise 400 (immutable). |
| `POST /proposal-versions/{id}/finalize` | A, PM | `configured` → `proposal_drafted`. |
| `PATCH /proposal-versions/{id}/narrative` | A, PM | Saves a human-reviewed narrative. |
| `POST /proposal-versions/{id}/submit` | A, PM | `proposal_drafted` → `awaiting_approval`. No UI yet (QD-412). |
| `POST /proposal-versions/{id}/approval-request` | A, PM | `{assigned_to}`: an Admin or Approver who is not the version's creator. No UI yet (QD-412). |
| `POST /proposal-versions/{id}/share` | A, PM | `approved` → `shared`. Records the hand-off; nothing is sent. 400 from any other status. |
| `POST /proposal-versions/{id}/outcome` | A, PM | `{outcome: won\|lost\|expired}`, `shared` → outcome (terminal). Won/Lost also set the opportunity status. 400 from any other status. |
| `GET /approval-requests` | A, Ap | Filter `status`. |
| `GET /approval-requests/{id}` | A, Ap | |
| `POST /approval-requests/{id}/approve` | A, Ap | Optional comment. The creator of the version cannot approve it. |
| `POST /approval-requests/{id}/request-changes` | A, Ap | Comment required; forks a new draft version. |
| `POST /ai/proposal-narrative` | A, PM | `{proposal_version_id, timeline?}` → draft narrative with `disclaimer`, `provider`, `model`. Not persisted. |
| `POST /ai/discovery-brief` | A, PM | `{opportunity_id, notes}` → draft `{summary, requirements[], open_questions[], unknowns[], disclaimer, provider, model}`. Not persisted. |
| `GET /organization/members` | A | Members of the caller's organization: `user_id`, `email`, `display_name`, `role`. |
| `PATCH /organization/members/{user_id}` | A | `{role}`. 400 if it would leave the organization without an Admin; 404 for a user outside the organization. Audited as `membership` / `role_change`. |
| `GET /organization/settings` | all | `{ai_fallback_enabled, ai_fallback_available}`. `available` is false unless the deployment sets `AI_FALLBACK_PROVIDER`. |
| `PATCH /organization/settings` | A | `{ai_fallback_enabled}`. Audited as `organization` / `update_settings`. |
| `GET /audit-events` | all | `entity_type`, `entity_id`, `limit`, `before_id`. Includes `actor_name` captured at write time. |

## AI endpoint failures
Both AI endpoints behave the same way on failure. A failed attempt is logged in `generation_logs` and nothing is saved.

| Status | Cause |
|---|---|
| 400 | Proposal has no lines (narrative only). |
| 500 | Provider misconfigured (e.g. missing API key). |
| 502 | Provider error, output that fails the schema, or output rejected by the output guard. |
| 504 | Provider timeout. |

Before any of these, a timeout, connection error, 5xx or 429 is retried once, then sent to the fallback if the tenant allows it ([ADR-005](../adr/ADR-005-provider-abstraction.md)). Successful responses carry `fallback_reason` (null unless the fallback answered).

No endpoint accepts a client-supplied tenant ID for authorization.
