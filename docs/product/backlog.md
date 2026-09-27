# Backlog

Mirrors the **QuoteDrive — MVP Delivery** Trello board (the source of truth for status) as of 2026-09-27. Gaps against the original plan are tracked in [plan-vs-built.md](plan-vs-built.md). IDs match the board; earlier drafts of this file numbered some Sprint 3–4 items differently.

| ID | Outcome | Sprint | Status |
|---|---|---|---|
| QD-001 | Create repository, baseline documentation, and local development contract | 0 | Done |
| QD-002 | Create full-stack project skeleton (React + FastAPI + PostgreSQL + Docker Compose) | 0 | Done |
| QD-003 | Define tenant, roles, and proposal lifecycle contracts | 0 | Done |
| QD-004 | Define synthetic demo data policy and seed narrative | 0 | Done |
| QD-005 | Establish CI quality gate (lint, typecheck, tests, build) | 0 | Done |
| QD-101 | Implement demo authentication and active organization context | 1 | Done |
| QD-102 | Implement membership/RBAC and tenant-scoped service layer | 1 | Done |
| QD-103 | Create premium dashboard shell and navigation | 1 | Done |
| QD-104 | Build dashboard summaries and activity timeline | 1 | Done |
| QD-105 | Add tenant isolation and RBAC test suite | 1 | Done |
| QD-201 | Implement customer and opportunity API | 2 | Done |
| QD-202 | Implement catalogue packages and synthetic seed data | 2 | Done |
| QD-203 | Build proposal builder UI | 2 | Done |
| QD-204 | Implement deterministic illustrative estimate service | 2 | Done |
| QD-205 | Implement immutable proposal version snapshots | 2 | Done |
| QD-206 | Build three-option package comparison view | 2 | Done |
| QD-301 | Implement proposal submission, approval requests, and decision workflow | 3 | Done |
| QD-302 | Build approval dashboard and version comparison UI | 3 | Done |
| QD-303 | Implement audit event service and timeline API | 3 | Done |
| QD-304 | Build activity timeline UI component | 3 | Done |
| QD-305 | Implement AI provider interface and adapters (OpenRouter, Ollama, FakeProvider) | 3 | Done |
| QD-306 | Implement OpenRouter proposal narrative generation endpoint | 3 | Done |
| QD-307 | Build AI narrative draft UI with provider badge and editor | 3 | Done |
| QD-308 | Wire discovery brief into AI narrative drafting | 3 | Done |
| QD-400 | Sprint 4 kickoff: close Sprint 3 carry-over (QD-301–QD-308) | 4 | In review |
| QD-401 | Build client-ready proposal preview | 4 | In review |
| QD-402 | Responsive, loading, error, and empty states across the app | 4 | In review |
| QD-403 | AI evaluation harness: run fixtures against FakeProvider in CI | 4 | Done |
| QD-404 | Discovery-brief AI drafting (build or formally defer) | 4 | Done |
| QD-405 | Full quality automation: Playwright E2E smoke, coverage, secrets scan | 4 | Done |
| QD-406 | Release documentation: README, diagrams, ADRs, runbooks, known limitations | 4 | In progress |
| QD-407 | Demo video and case-study outline | 4 | Ready |
| QD-408 | Release candidate: human E2E test pass and v1.0.0 sign-off | 4 | Ready |
| QD-409 | UI foundation: adopt Shadcn Admin shell + components (navy/lime), restyle existing screens | 4 | Done |
| QD-410 | Harden AI narrative against injected instructions and invented commercial terms | 4 | Done |
| QD-411 | Enable E2E in CI at sprint end (make Playwright a merge gate) | 4 | Inbox |
| QD-412 | UI: submit a finalized version for approval (pick approver) | 4 | Inbox |
| QD-413 | Customers & opportunities UI: create, edit, search, activity history | 4 | Inbox |
| QD-414 | Share with customer and record outcome (Approved → Shared → Won/Lost/Expired) | 4 | Inbox |
| QD-415 | Admin catalogue management (packages and add-ons) | 4 | Inbox |
| QD-416 | Workspace settings: members and roles | 4 | Inbox |
| QD-417 | AI provider fallback and retry (ADR-005): OpenRouter → Ollama, visible provenance | 4 | Inbox |
| QD-418 | AI eval scenario scoring and pass-percentage release threshold | 4 | Inbox |
| QD-419 | Accessibility fix: demo sign-in buttons exposed as list items | 4 | Inbox |

Sprint 0 is foundation, 1 is tenancy and the dashboard, 2 is configurable proposals, 3 is approvals and controlled AI, and 4 is hardening and release. See [mvp-scope-and-roadmap.md](mvp-scope-and-roadmap.md).

Status changes happen on the board. Refresh this table when a release is cut.
