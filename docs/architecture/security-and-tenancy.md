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

## Tests
Cross-tenant read/write, viewer mutation, self-approval, illegal state transition, and provider failure without state mutation are release-blocking API tests.
