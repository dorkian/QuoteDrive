# Plan vs Built (v1.0.0 audit)

Every commitment in the planning docs, checked against the code on 2026-09-27. Anything planned but not yet built has a card, so nothing planned is left untracked.

Legend: ✅ built · 🟡 partly built · ⏳ not built, has a card.

## Functional requirements ([functional-requirements.md](functional-requirements.md))
| Req | Commitment | Status | Where / card |
|---|---|---|---|
| FR-01 | Demo sign-in for four roles; tenant from membership; scoped reads and writes | ✅ | QD-101, QD-102, QD-105 |
| FR-02 | Create, list, search and update customers | ✅ Customers page: search, create, edit, delete (QD-413) | — |
| FR-02 | Create an opportunity linked to a customer and owner | ✅ "New opportunity" dialog; the owner is the creator (QD-413) | — |
| FR-02 | Store brief, status, activity history | ✅ Brief (QD-404); title and status editing and an Activity section on the opportunity page (QD-413) | — |
| FR-03 | Admin manages packages and add-ons | ✅ Settings › Catalogue: create, edit, deactivate (QD-415) | — |
| FR-03 | Manager adds lines, quantities, assumptions; inactive items can't be selected | ✅ | QD-203, QD-204 |
| FR-04 | Server-side estimate formula, totals, disclaimer, versioning | ✅ | QD-204, QD-205, QD-401 |
| FR-05 | Manager submits a version for review | ✅ Submit-for-approval button with approver picker | QD-412 |
| FR-05 | Approve or request changes with a comment; no self-approval; audit events | ✅ | QD-301, QD-302, QD-303 |
| FR-06 | Narrative and discovery drafts, editable, labelled, never change state | ✅ | QD-305–QD-308, QD-404, QD-410 |
| FR-06 | Fallback reason recorded | ✅ `generation_logs.fallback_reason`, response and saved draft | QD-417 |

## Lifecycle and permissions ([security-and-tenancy.md](../architecture/security-and-tenancy.md))
| Commitment | Status | Where / card |
|---|---|---|
| Draft → Configured → Proposal Drafted → Awaiting Approval → Approved / Changes Requested | ✅ | QD-205, QD-301, QD-412 |
| Approved → Shared → Won / Lost / Expired; "Share" and "Record outcome" permissions | ✅ Share and outcome actions on the version page, dashboard outcome counts (QD-414) | — |
| "Manage catalogue items" (Admin) | ✅ | QD-415 |
| Release-blocking tests: cross-tenant, viewer mutation, self-approval, illegal transition, provider failure without state change | ✅ | QD-105, QD-301, QD-403 |

## Non-functional requirements ([non-functional-requirements.md](non-functional-requirements.md))
| Commitment | Status | Where / card |
|---|---|---|
| Synthetic data, server-side tenancy and roles, no secrets in logs | ✅ | QD-004, QD-102, QD-405 (gitleaks) |
| Explicit, tested workflow transitions | ✅ | QD-205, QD-301 |
| OpenRouter retries one transient failure | ✅ | QD-417 |
| Optional, tenant-permitted, visible Ollama fallback | ✅ Settings › AI opt-in; provenance badge shows the reason | QD-417 |
| Provider failure doesn't change proposal state | ✅ | QD-306, QD-403 |
| Unit, API and UI tests; CI format/lint/typecheck/tests/build | ✅ | QD-005, QD-405 |
| Playwright smoke of the demo journey | 🟡 Built; runs manually in CI | ⏳ QD-411 |
| Keyboard access, labels, focus, semantic structure | ✅ Sign-in buttons are real buttons | ✅ QD-419 |
| Responsive; mobile supports reading and basic review | ✅ | QD-402, QD-409 |

## Product vision and journeys ([product-vision.md](product-vision.md), [personas-and-user-journeys.md](personas-and-user-journeys.md))
| Commitment | Status | Where / card |
|---|---|---|
| Admin configures the workspace: catalogue, members, roles, feature settings | ✅ Settings › Members, Catalogue and AI | QD-415, QD-416, QD-417 |
| Goal 3: AI provenance, **fallback behavior** and human review visible | ✅ | QD-417 |
| Journey 1–8 end to end in the UI | ✅ | QD-412 |
| Viewer reads shared or approved proposals | ✅ Client preview covers approved, shared and closed versions | QD-401, QD-414 |

## Roadmap ([mvp-scope-and-roadmap.md](mvp-scope-and-roadmap.md)) and quality plans
| Commitment | Status | Where / card |
|---|---|---|
| Weekends 1–3 scope | ✅, except the items above | see above |
| Weekend 4: preview, states, test hardening, diagrams, README/runbooks | ✅ | QD-401, QD-402, QD-405, QD-406 |
| Weekend 4: demo video and first case-study article | ✅ Video published (https://youtu.be/moJ5Xb1Y_3g); case study in `docs/case-study` | QD-407 |
| Release sign-off and human E2E pass | ⏳ | ⏳ QD-408 |
| AI eval plan cases 1–7 and 10 | ✅ | QD-403, QD-404, QD-410 |
| AI eval plan cases 8–9 (fallback / no fallback) | ✅ Run in CI with fakes | QD-417 |
| Scenario scoring and pass-percentage approval (PO request during QD-403) | ✅ Live runs score every check, write a report to `docs/evaluations/reports/` and fail below 90% or on any safety failure | QD-418 |
| ADR-005 fallback | ✅ | QD-417 |
| ADR-008 approval | Proposed | PO decision |

Deliberately out of scope (not gaps): billing, email sending, PDF rendering, SSO, third-party integrations, real marketplace data, public deployment, and autonomous agents.
