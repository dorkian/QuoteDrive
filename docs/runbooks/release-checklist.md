# Release Checklist

Run before tagging a release (for v1.0.0 this is card QD-408).

## Automated (CI green on `main`)
- [ ] backend: format, lint, mypy, offline migration check, pytest with coverage floor.
- [ ] frontend: format, lint, typecheck, Vitest with coverage floors, build.
- [ ] secrets: gitleaks over the full history.
- [ ] AI evaluation fixtures pass with FakeProvider (part of pytest).
- [ ] E2E: run `.github/workflows/e2e.yml` manually (Actions → E2E → Run workflow) until it runs on every PR (QD-411).

## Manual
- [ ] Fresh clone: follow the README Quickstart literally on a machine without the repo; the app loads and demo sign-in works.
- [ ] Demo journey (README "Demo walkthrough") completed as manager and approver, with a real AI provider configured.
- [ ] Tenant isolation spot check: another tenant's opportunity URL shows "not found".
- [ ] Synthetic-data and illustrative-estimate disclaimers visible on the builder and the client preview.
- [ ] No secrets, real customer data or employer/confidential information in the repository or screenshots.
- [ ] README, ADR index, API contract, data model, known limitations and screenshots match what ships.
- [ ] CHANGELOG entry dated; tag `vX.Y.Z` created by the Product Owner.
- [ ] Demo recorded (QD-407).
