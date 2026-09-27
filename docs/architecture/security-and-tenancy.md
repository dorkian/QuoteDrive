# Security and Tenancy

## Threats addressed
- Cross-tenant data exposure.
- Viewer or manager performing an unauthorized action.
- Proposal owner self-approving.
- AI output being treated as a trusted command.
- Secrets appearing in logs/repository.

## Controls
1. Derive active organization from JWT/session membership.
2. Pass `organization_id` explicitly through services/repositories.
3. Assert tenant scope in every GET/UPDATE/DELETE path.
4. Return a non-leaking 404/403 for cross-tenant access.
5. Validate role and state transition server-side.
6. Store AI requests/results as records, but redact secrets and avoid personal data.
7. Use synthetic seed data only.

## Roles and permissions

| Action | Admin | Proposal Manager | Approver | Viewer |
|---|---|---|---|---|
| Manage catalogue items (FR-03) | ✓ | – | – | – |
| Create/edit customers & opportunities (FR-02) | ✓ | ✓ | – | – |
| Configure a proposal version (add lines, FR-03) | ✓ | ✓ | – | – |
| Submit a version for approval (FR-05) | ✓ | ✓ | – | – |
| Approve / request changes (FR-05) | ✓ | – | ✓ | – |
| Approve their own submitted version | ✗ | ✗ | ✗ | ✗ |
| View customers, opportunities, proposals, audit trail | ✓ | ✓ | ✓ | ✓ |
| Request AI narrative/discovery draft (FR-06) | ✓ | ✓ | – | – |
| Share proposal with customer | ✓ | ✓ | – | – |
| Record outcome (Won / Lost / Expired) | ✓ | ✓ | – | – |

Self-approval is denied regardless of role — it's a same-user check (`proposal_versions.created_by` vs. the approving actor), not a role gate.

## Proposal lifecycle

Happy path: `Draft → Configured → Proposal Drafted → Awaiting Approval → Approved → Shared → {Won | Lost | Expired}`.
Rejection branch: `Awaiting Approval → Changes Requested` (terminal for that version; see guard on the "Request changes" row below).

| From | Action | To | Allowed roles | Guard |
|---|---|---|---|---|
| (new) | Create opportunity | Draft | Admin, Proposal Manager | — |
| Draft, Configured | Add/edit catalogue lines | Configured | Admin, Proposal Manager | version not yet submitted |
| Configured | Request AI narrative draft | Configured | Admin, Proposal Manager | draft only, doesn't change state (FR-06) |
| Configured | Finalize draft (attach narrative, mark ready) | Proposal Drafted | Admin, Proposal Manager | manual action — AI generation alone never advances state (FR-06) |
| Proposal Drafted | Submit for approval | Awaiting Approval | Admin, Proposal Manager | version snapshot becomes stable (ADR-006) |
| Awaiting Approval | Approve | Approved | Admin, Approver | actor ≠ `created_by` |
| Awaiting Approval | Request changes | this version → Changes Requested (terminal); new version created in Draft | Admin, Approver | actor ≠ `created_by`; the requested-changes version stays immutable, same as any other closed version (ADR-006) |
| Approved | Share with customer (`POST …/share`) | Shared | Admin, Proposal Manager | records the hand-off only; nothing is sent |
| Shared | Outcome recorded (`POST …/outcome`) | Won / Lost / Expired | Admin, Proposal Manager | terminal states. Won and Lost also set the opportunity status; Expired leaves the opportunity open |
| Approved, Shared | Edit | new Draft version | Admin, Proposal Manager | prior version immutable (ADR-006); editing creates a new version (FR-04) |

Every transition is server-side only and must emit an `audit_events` row (FR-05). Queue/approval-queue queries must scope to `awaiting_approval` only — a version moved to `changes_requested` is no longer pending review.

## Tests
Cross-tenant read/write, viewer mutation, self-approval, illegal state transition, and provider failure without state mutation are release-blocking API tests.
