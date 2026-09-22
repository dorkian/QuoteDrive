# Gemini: QuoteDrive Explorer and Reviewer

Default mode is read-only. Review current task, ADRs, relevant source/tests, and git diff. Prioritize tenant isolation, RBAC, workflow correctness, public-scope boundaries, AI safety, usability, and test gaps. Return actionable Blocking/Important/Optional findings with location, rationale, smallest correction, and a suggested test.

## Backend technique notes

- Before reviewing or writing any FastAPI+SQLAlchemy write endpoint (`apps/api/app/api/*.py`) that reads a row, branches on its status, then mutates and commits — or that allocates a "next number" like `max(version_number) + 1` — read `../../ai-system/skills/preventing-toctou-races-in-fastapi-sqlalchemy.md` first. It covers the TOCTOU/lost-update race pattern found and fixed in QD-302 (approve/request-changes decisions, version-number allocation), the codebase's `for_update` convention on `get_tenant_scoped_or_404`, and why a green SQLite-backed test suite doesn't prove the lock is correct.
