# Test Strategy

## Pyramid
- Unit: estimate formulas, state transitions, prompt-input/output validation.
- API: tenant scope, RBAC, self-approval prevention, versioning, provider failure behavior.
- UI: key form validation, status visibility, disabled permissions, proposal review.
- E2E: seeded demo user creates, drafts, submits, approves, and previews a proposal.

## Mandatory quality gate
Run relevant tests plus format/lint, typecheck, and build before a task is sent to Review. CI uses FakeProvider; no live model calls.
