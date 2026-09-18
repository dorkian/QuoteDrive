# Quality Gates

## Local
- Frontend: formatter, lint, TypeScript check, component tests, production build.
- Backend: formatter, lint, type check, pytest.
- Cross-cutting: migration check and targeted integration/e2e test when workflow changes.

## CI
Pull requests must run the same checks. A failed quality gate blocks a Trello move to AI/Human Review.
