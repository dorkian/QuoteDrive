# Non-functional Requirements

## Security and data
- Use synthetic data only.
- Enforce tenant isolation at service/query level.
- Role checks are server-side.
- Do not log API keys, raw authorization headers, or secret prompt variables.

## Reliability
- Explicit, tested workflow transitions.
- OpenRouter may retry one transient technical failure.
- Ollama fallback is optional, tenant-permitted, and visible in the UI. *(Deferred in v1.0.0: one provider is configured at a time.)*
- Provider failure does not mutate proposal state.

## Quality
- Unit tests for estimation and state transitions.
- API tests for tenancy and RBAC.
- UI tests for key workflow states.
- Playwright smoke test for demo journey.
- CI runs format/lint, typecheck, tests, and build.

## Accessibility and UX
- Keyboard-accessible controls, labels, focus states, semantic headings, and status text.
- Responsive desktop/tablet flow; mobile supports reading and basic review.
