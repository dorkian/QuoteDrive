# Plan vs Built (v1.0.0 audit)

Every commitment in the planning docs, checked against the code on 2026-09-27. Anything planned but not yet built has a card, so nothing planned is left untracked.

Legend: ✅ built · 🟡 partly built · ⏳ not built, has a card.

## Functional requirements ([functional-requirements.md](functional-requirements.md))
| Req | Commitment | Status | Where / card |
|---|---|---|---|
| FR-01 | Demo sign-in for four roles; tenant from membership; scoped reads and writes | ✅ | QD-101, QD-102, QD-105 |
| FR-02 | Create, list, search and update customers | 🟡 API only; the Customers page is a placeholder | ⏳ QD-413 |
| FR-02 | Create an opportunity linked to a customer and owner | 🟡 API only | ⏳ QD-413 |
| FR-02 | Store brief, status, activity history | 🟡 Brief (QD-404) and audit exist; no history shown on the opportunity page | ⏳ QD-413 |
| FR-03 | Admin manages packages and add-ons | ⏳ Seed-only catalogue | ⏳ QD-415 |
| FR-03 | Manager adds lines, quantities, assumptions; inactive items can't be selected | ✅ | QD-203, QD-204 |
| FR-04 | Server-side estimate formula, totals, disclaimer, versioning | ✅ | QD-204, QD-205, QD-401 |
| FR-05 | Manager submits a version for review | 🟡 API only | ⏳ QD-412 |
| FR-05 | Approve or request changes with a comment; no self-approval; audit events | ✅ | QD-301, QD-302, QD-303 |
| FR-06 | Narrative and discovery drafts, editable, labelled, never change state | ✅ | QD-305–QD-308, QD-404, QD-410 |
| FR-06 | Fallback reason recorded | ⏳ No fallback exists | ⏳ QD-417 |

## Lifecycle and permissions ([security-and-tenancy.md](../architecture/security-and-tenancy.md))
| Commitment | Status | Where / card |
|---|---|---|
| Draft → Configured → Proposal Drafted → Awaiting Approval → Approved / Changes Requested | ✅ (submit has no UI yet) | QD-205, QD-301; ⏳ QD-412 |
| Approved → Shared → Won / Lost / Expired; "Share" and "Record outcome" permissions | ⏳ Statuses exist, no transitions | ⏳ QD-414 |
| "Manage catalogue items" (Admin) | ⏳ | ⏳ QD-415 |
| Release-blocking tests: cross-tenant, viewer mutation, self-approval, illegal transition, provider failure without state change | ✅ | QD-105, QD-301, QD-403 |

## Non-functional requirements ([non-functional-requirements.md](non-functional-requirements.md))
| Commitment | Status | Where / card |
|---|---|---|
| Synthetic data, server-side tenancy and roles, no secrets in logs | ✅ | QD-004, QD-102, QD-405 (gitleaks) |
| Explicit, tested workflow transitions | ✅ | QD-205, QD-301 |
| OpenRouter retries one transient failure | ⏳ | ⏳ QD-417 |
| Optional, tenant-permitted, visible Ollama fallback | ⏳ | ⏳ QD-417 |
| Provider failure doesn't change proposal state | ✅ | QD-306, QD-403 |
| Unit, API and UI tests; CI format/lint/typecheck/tests/build | ✅ | QD-005, QD-405 |
| Playwright smoke of the demo journey | 🟡 Built; runs manually in CI | ⏳ QD-411 |
| Keyboard access, labels, focus, semantic structure | 🟡 One defect: sign-in buttons exposed as list items | ⏳ QD-419 |
| Responsive; mobile supports reading and basic review | ✅ | QD-402, QD-409 |

## Product vision and journeys ([product-vision.md](product-vision.md), [personas-and-user-journeys.md](personas-and-user-journeys.md))
| Commitment | Status | Where / card |
|---|---|---|
| Admin configures the workspace: catalogue, members, roles, feature settings | ⏳ The Settings page is a placeholder | ⏳ QD-415, QD-416, QD-417 (AI setting) |
| Goal 3: AI provenance, **fallback behavior** and human review visible | 🟡 Provenance and review ✅; fallback ⏳ | ⏳ QD-417 |
| Journey 1–8 end to end in the UI | 🟡 Steps 1 (create opportunity) and 5 (submit) need the API | ⏳ QD-413, QD-412 |
| Viewer reads shared or approved proposals | 🟡 Approved ✅; shared needs QD-414 | ⏳ QD-414 |

## Roadmap ([mvp-scope-and-roadmap.md](mvp-scope-and-roadmap.md)) and quality plans
| Commitment | Status | Where / card |
|---|---|---|
| Weekends 1–3 scope | ✅, except the items above | see above |
| Weekend 4: preview, states, test hardening, diagrams, README/runbooks | ✅ | QD-401, QD-402, QD-405, QD-406 |
| Weekend 4: demo video and first case-study article | ⏳ | ⏳ QD-407 |
| Release sign-off and human E2E pass | ⏳ | ⏳ QD-408 |
| AI eval plan cases 1–7 and 10 | ✅ | QD-403, QD-404, QD-410 |
| AI eval plan cases 8–9 (fallback / no fallback) | ⏳ | ⏳ QD-417 |
| Scenario scoring and pass-percentage approval (PO request during QD-403) | ⏳ | ⏳ QD-418 |
| ADR-005 fallback | 🟡 | ⏳ QD-417 |
| ADR-008 approval | Proposed | PO decision |

Deliberately out of scope (not gaps): billing, email sending, PDF rendering, SSO, third-party integrations, real marketplace data, public deployment, and autonomous agents.
